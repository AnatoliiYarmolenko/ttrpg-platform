const { Prisma } = require('@prisma/client');
const { logger } = require('../../lib/logger');
const VALID_PARTICIPANT_STATUSES = new Set(['PENDING', 'CONFIRMED', 'DECLINED']);
const JOINABLE_SESSION_STATUSES = new Set(['PLANNED']);

function parseId(value) {
  return Number.parseInt(value, 10);
}

function normalizeJoinRole(role, AppError, ERROR_CODES) {
  const normalizedRole = String(role || 'PLAYER').toUpperCase();

  if (!['PLAYER', 'GM'].includes(normalizedRole)) {
    throw new AppError(ERROR_CODES.SESSION_JOIN_ROLE_INVALID);
  }

  return normalizedRole;
}

function assertJoinableSession(session, AppError, ERROR_CODES) {
  if (!JOINABLE_SESSION_STATUSES.has(session.status)) {
    throw new AppError(ERROR_CODES.SESSION_JOIN_STATUS_FORBIDDEN, null, {
      status: session.status,
    });
  }

  if (session.campaign?.status === 'FINISHED') {
    throw new AppError(ERROR_CODES.SESSION_JOIN_CAMPAIGN_FINISHED);
  }

  if (new Date(session.date) < new Date()) {
    throw new AppError(ERROR_CODES.SESSION_JOIN_ALREADY_STARTED);
  }
}

async function assertUserNotJoinedYet({ prisma, sessionId, userId, AppError, ERROR_CODES }) {
  const existingParticipant = await prisma.sessionParticipant.findUnique({
    where: {
      userId_sessionId: { userId, sessionId: parseId(sessionId) },
    },
  });

  if (existingParticipant) {
    throw new AppError(ERROR_CODES.SESSION_JOIN_ALREADY_PARTICIPANT);
  }
}

function assertPlayerCapacity({ normalizedRole, session, AppError, ERROR_CODES }) {
  if (normalizedRole !== 'PLAYER') {
    return;
  }

  const playerCount = session.participants.filter((participant) => participant.role === 'PLAYER').length;
  if (playerCount >= session.maxPlayers) {
    throw new AppError(ERROR_CODES.SESSION_JOIN_NO_FREE_PLAYER_SLOTS);
  }
}

function assertGmCanJoin({ normalizedRole, session, permissionHelpers, AppError, ERROR_CODES }) {
  if (normalizedRole !== 'GM') {
    return;
  }

  const confirmedGm = permissionHelpers._getConfirmedGm(session);
  if (confirmedGm) {
    throw new AppError(ERROR_CODES.SESSION_GM_ALREADY_EXISTS);
  }
}

function assertCampaignPlayerAccess({
  normalizedRole,
  session,
  AppError,
  ERROR_CODES,
}) {
  const isCampaignSession = Boolean(session.campaignId);
  const isCampaignMember = Boolean(session.viewer?.isCampaignMember);

  if (
    normalizedRole === 'PLAYER'
    && isCampaignSession
    && session.visibility === 'PRIVATE'
    && !isCampaignMember
  ) {
    throw new AppError(ERROR_CODES.SESSION_JOIN_PRIVATE_CAMPAIGN_MEMBERS_ONLY);
  }
}

function resolveJoinStatus({ normalizedRole, session }) {
  const isCampaignSession = Boolean(session.campaignId);
  const isCampaignMember = Boolean(session.viewer?.isCampaignMember);

  if (normalizedRole !== 'PLAYER') {
    return 'PENDING';
  }

  if (!isCampaignSession && session.visibility === 'PUBLIC') {
    return 'CONFIRMED';
  }

  if (isCampaignSession && session.visibility === 'PRIVATE' && isCampaignMember) {
    return 'CONFIRMED';
  }

  return 'PENDING';
}

function resolveGuestFlag({ normalizedRole, session }) {
  return normalizedRole === 'PLAYER'
    && Boolean(session.campaignId)
    && session.visibility === 'PUBLIC'
    && !session.viewer?.isCampaignMember;
}

function assertValidParticipantStatus(status, AppError, ERROR_CODES) {
  if (!VALID_PARTICIPANT_STATUSES.has(status)) {
    throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_STATUS_INVALID);
  }
}

function assertSessionIsActiveForParticipantManagement(session, AppError, ERROR_CODES) {
  if (['FINISHED', 'CANCELED'].includes(session.status)) {
    throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_MANAGEMENT_UNAVAILABLE);
  }
}

async function findParticipantOrThrow({ prisma, participantId, sessionId, AppError, ERROR_CODES }) {
  const participant = await prisma.sessionParticipant.findUnique({
    where: { id: parseId(participantId) },
  });

  if (!participant?.sessionId || participant.sessionId !== parseId(sessionId)) {
    throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_NOT_FOUND);
  }

  return participant;
}

async function declinePendingParticipant({
  prisma,
  participant,
  participantId,
  AppError,
  ERROR_CODES,
  notificationService,
  walletService,
}) {
  if (participant.status !== 'PENDING') {
    throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_DECLINE_PENDING_ONLY);
  }

  return await prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: participant.sessionId },
      select: { id: true, title: true, price: true },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_NOT_FOUND);
    }

    await tx.sessionParticipant.delete({
      where: { id: parseId(participantId) },
    });

    const decPrice = new Prisma.Decimal(session.price || 0);
    if (participant.role === 'PLAYER' && decPrice.gt(0)) {
      await walletService.refundFunds(participant.userId, session.id, decPrice, tx);

      await tx.session.update({
        where: { id: session.id },
        data: {
          heldAmount: { decrement: decPrice },
        },
      });
    }

    if (notificationService) {
      try {
        await notificationService.createNotification({
          eventKey: `session_declined:${participant.userId}:${session.id}`,
          type: 'SESSION_PARTICIPATION_DECLINED',
          severity: 'ERROR',
          category: 'session',
          title: 'Заявку відхилено',
          body: `Вашу заявку на сесію "${session.title || 'Нова сесія'}" відхилено.`,
          link: `/session/${session.id}`,
          recipientIds: [participant.userId],
          metadata: {
            sessionId: session.id,
            userId: participant.userId,
          },
        }, tx);
      } catch (err) {
        logger.error({ err, userId: participant.userId, sessionId: session.id }, 'Помилка відправки сповіщення про відхилення заявки');
      }
    }

    return {
      ...participant,
      status: 'DECLINED',
    };
  });
}

async function confirmGmParticipant({
  prisma,
  participantId,
  sessionId,
  notificationService,
}) {
  const participantIdInt = parseId(participantId);
  const sessionIdInt = parseId(sessionId);

  return prisma.$transaction(async (tx) => {
    const updatedParticipant = await tx.sessionParticipant.update({
      where: { id: participantIdInt },
      data: { status: 'CONFIRMED' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    await tx.sessionParticipant.deleteMany({
      where: {
        sessionId: sessionIdInt,
        role: 'GM',
        status: 'PENDING',
        NOT: { id: participantIdInt },
      },
    });

    if (notificationService && updatedParticipant) {
      const session = await tx.session.findUnique({
        where: { id: sessionIdInt },
        select: { id: true, title: true },
      });
      if (session) {
        try {
          await notificationService.createNotification({
            eventKey: `session_confirmed:${updatedParticipant.userId}:${sessionIdInt}`,
            type: 'SESSION_PARTICIPATION_CONFIRMED',
            severity: 'SUCCESS',
            category: 'session',
            title: 'Ви додані до сесії',
            body: `Вас додано до сесії "${session.title || 'Нова сесія'}".`,
            link: `/session/${sessionIdInt}`,
            recipientIds: [updatedParticipant.userId],
            metadata: {
              sessionId: sessionIdInt,
              participantId: updatedParticipant.id,
              role: updatedParticipant.role,
            },
          }, tx);
        } catch (err) {
          logger.error({ err, userId: updatedParticipant.userId, sessionId: sessionIdInt }, 'Помилка відправки сповіщення про підтвердження GM');
        }
      }
    }

    return updatedParticipant;
  });
}

async function updateParticipantStatusRecord({ prisma, participantId, status, notificationService }) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.sessionParticipant.update({
      where: { id: parseId(participantId) },
      data: { status },
      include: {
        session: { select: { id: true, title: true } },
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    if (notificationService && status === 'CONFIRMED' && participant.session) {
      try {
        await notificationService.createNotification({
          eventKey: `session_confirmed:${participant.userId}:${participant.sessionId}`,
          type: 'SESSION_PARTICIPATION_CONFIRMED',
          severity: 'SUCCESS',
          category: 'session',
          title: 'Ви додані до сесії',
          body: `Вас додано до сесії "${participant.session.title || 'Нова сесія'}".`,
          link: `/session/${participant.sessionId}`,
          recipientIds: [participant.userId],
          metadata: {
            sessionId: participant.sessionId,
            participantId: participant.id,
            role: participant.role,
          },
        }, tx);
      } catch (err) {
        logger.error({ err, userId: participant.userId, sessionId: participant.sessionId }, 'Помилка відправки сповіщення про підтвердження учасника');
      }
    }

    return participant;
  });
}

function createSessionParticipantsService({
  prisma,
  AppError,
  ERROR_CODES,
  sessionQueryService,
  getSessionById,
  resolveSessionContext,
  datetimeHelpers,
  assertNoSessionTimeConflict,
  permissionHelpers,
  notificationService,
  walletService,
}) {
  const resolveGetSessionById = sessionQueryService?.getSessionById || getSessionById;
  const resolveSessionContextFn = sessionQueryService?.resolveSessionContext || resolveSessionContext;
  const assertNoSessionTimeConflictFn = assertNoSessionTimeConflict || (async (userId, targetStart, targetDuration, options = {}) => {
    return datetimeHelpers._assertNoSessionTimeConflict(
      { prisma, AppError, ERROR_CODES },
      userId,
      targetStart,
      targetDuration,
      options
    );
  });

  if (
    typeof resolveGetSessionById !== 'function'
    || typeof resolveSessionContextFn !== 'function'
    || typeof assertNoSessionTimeConflictFn !== 'function'
  ) {
    throw new TypeError('Сервіс учасників сесії вимагає залежності сервісу запитів сесії');
  }



  async function notifyManagersAboutJoinRequest(session, participant, tx) {
    if (!notificationService) return;
    const existingPending = session.participants.filter(
      (p) => p.status === 'PENDING'
    ).length;
    const pendingCount = participant.status === 'PENDING' ? existingPending + 1 : existingPending;


    const sessionTitle = session.title || 'Нова сесія';

    try {
      await notificationService.createNotification({
        eventKey: `session_join_requests:${session.id}`,
        type: 'SESSION_JOIN_REQUESTS_UPDATED',
        severity: 'INFO',
        category: 'session',
        title: `До сесії "${sessionTitle}" подано нові заявки`,
        body: `Очікує підтвердження: ${pendingCount}`,
        link: `/session/${session.id}`,
        audience: ['session_managers'],
        context: { sessionId: session.id },
        dedupeKey: `session:${session.id}:join_requests`,
        dedupeWindowMs: 10 * 60 * 1000, // 10 minutes
        metadata: {
          sessionId: session.id,
          pendingCount,
          requesterId: participant.userId,
          role: participant.role,
        },
      }, tx);
    } catch (err) {
      logger.error({ err, sessionId: session.id }, 'Помилка відправки сповіщення менеджерам про нову заявку');
    }
  }

  async function notifyManagersAboutConfirmedJoin(session, participant, tx) {
    if (!notificationService) return;

    const userName = participant.user?.displayName || participant.user?.username || 'Новий учасник';
    const roleLabel = participant.role === 'GM' ? 'гравець-майстер' : 'гравець';
    const sessionTitle = session.title || 'Нова сесія';

    try {
      await notificationService.createNotification({
        eventKey: `session_confirmed_join:${session.id}:${participant.userId}`,
        type: 'SESSION_PARTICIPANT_JOINED',
        severity: 'INFO',
        category: 'session',
        title: `До сесії "${sessionTitle}" приєднався новий учасник`,
        body: `${userName} (${roleLabel}) приєднався до сесії.`,
        link: `/session/${session.id}`,
        audience: ['session_managers'],
        context: { sessionId: session.id },
        metadata: {
          sessionId: session.id,
          participantId: participant.id,
          userId: participant.userId,
          role: participant.role,
        },
      }, tx);
    } catch (err) {
      logger.error({ err, userId: participant.userId, sessionId: session.id }, 'Помилка відправки сповіщення менеджерам про приєднання учасника');
    }
  }


  return {
    async joinSession(sessionId, userId, options = {}) {
      const { role = 'PLAYER', shareToken = null } = options;
      const session = await resolveGetSessionById(sessionId, userId, { shareToken });
      const normalizedRole = normalizeJoinRole(role, AppError, ERROR_CODES);

      assertJoinableSession(session, AppError, ERROR_CODES);
      await assertUserNotJoinedYet({ prisma, sessionId, userId, AppError, ERROR_CODES });

      await assertNoSessionTimeConflictFn(
        userId,
        session.date,
        session.duration,
        {
          excludeSessionId: session.id,
          conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER,
        }
      );

      assertPlayerCapacity({ normalizedRole, session, AppError, ERROR_CODES });
      assertGmCanJoin({ normalizedRole, session, permissionHelpers, AppError, ERROR_CODES });
      assertCampaignPlayerAccess({ normalizedRole, session, AppError, ERROR_CODES });

      const participant = await prisma.$transaction(async (tx) => {
        const newParticipant = await tx.sessionParticipant.create({
          data: {
            userId,
            sessionId: parseId(sessionId),
            role: normalizedRole,
            status: resolveJoinStatus({ normalizedRole, session }),
            isGuest: resolveGuestFlag({ normalizedRole, session }),
          },
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        });

        const decPrice = new Prisma.Decimal(session.price || 0);
        if (normalizedRole === 'PLAYER' && decPrice.gt(0)) {
          await walletService.reserveFunds(userId, session.id, decPrice, tx);

          await tx.session.update({
            where: { id: session.id },
            data: {
              heldAmount: { increment: decPrice },
            },
          });
        }

        if (newParticipant.status === 'PENDING') {
          await notifyManagersAboutJoinRequest(session, newParticipant, tx);
        } else if (newParticipant.status === 'CONFIRMED') {
          await notifyManagersAboutConfirmedJoin(session, newParticipant, tx);
        }

        return newParticipant;
      });

      return participant;
    },

    async leaveSession(sessionId, userId) {
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: { userId, sessionId: parseId(sessionId) },
        },
        include: {
          session: {
            select: {
              id: true,
              ownerId: true,
              status: true,
              date: true,
              price: true,
            },
          },
        },
      });

      if (!participant) {
        throw new AppError(ERROR_CODES.SESSION_LEAVE_NOT_PARTICIPANT);
      }

      if (['FINISHED', 'CANCELED'].includes(participant.session.status)) {
        throw new AppError(ERROR_CODES.SESSION_LEAVE_FINISHED_OR_CANCELED_FORBIDDEN);
      }

      if (participant.session.status === 'ACTIVE') {
        throw new AppError(ERROR_CODES.SESSION_LEAVE_ACTIVE_FORBIDDEN);
      }

      if (participant.role === 'GM' && participant.session.ownerId === userId) {
        throw new AppError(ERROR_CODES.SESSION_OWNER_GM_LEAVE_FORBIDDEN);
      }

      return await prisma.$transaction(async (tx) => {
        await tx.sessionParticipant.delete({
          where: {
            userId_sessionId: { userId, sessionId: parseId(sessionId) },
          },
        });

        const decPrice = new Prisma.Decimal(participant.session.price || 0);
        if (participant.role === 'PLAYER' && (participant.status === 'PENDING' || participant.status === 'CONFIRMED') && decPrice.gt(0)) {
          await walletService.refundFunds(userId, participant.session.id, decPrice, tx);

          await tx.session.update({
            where: { id: participant.session.id },
            data: {
              heldAmount: { decrement: decPrice },
            },
          });
        }

        return participant;
      });
    },

    async getSessionParticipants(sessionId, userId = null) {
      const session = await resolveGetSessionById(sessionId, userId);
      return session.participants;
    },

    async updateParticipantStatus(sessionId, participantId, requesterId, status, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContextFn(sessionId, requesterId, preloadedSession);

      assertValidParticipantStatus(status, AppError, ERROR_CODES);
      assertSessionIsActiveForParticipantManagement(session, AppError, ERROR_CODES);

      const participant = await findParticipantOrThrow({
        prisma,
        participantId,
        sessionId,
        AppError,
        ERROR_CODES,
      });

      if (status === 'DECLINED') {
        return declinePendingParticipant({
          prisma,
          participant,
          participantId,
          AppError,
          ERROR_CODES,
          notificationService,
          walletService,
        });
      }

      if (participant.role === 'GM') {
        if (!permissionHelpers._isSessionOwner(session, requesterId)) {
          throw new AppError(ERROR_CODES.SESSION_GM_REQUESTS_OWNER_ONLY);
        }

        if (status === 'CONFIRMED') {
          return confirmGmParticipant({
            prisma,
            participantId,
            sessionId,
          });
        }
      } else if (!permissionHelpers._canManageParticipants(session, requesterId)) {
        throw new AppError(ERROR_CODES.SESSION_PARTICIPANTS_MANAGE_OWNER_OR_CONFIRMED_GM_ONLY);
      }

      return updateParticipantStatusRecord({ prisma, participantId, status, notificationService });
    },

    async removeParticipant(sessionId, participantId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContextFn(sessionId, requesterId, preloadedSession);

      if (['FINISHED', 'CANCELED'].includes(session.status)) {
        throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_REMOVAL_UNAVAILABLE);
      }

      const participant = await prisma.sessionParticipant.findUnique({
        where: { id: parseId(participantId) },
      });

      if (!participant?.sessionId || participant.sessionId !== parseId(sessionId)) {
        throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_NOT_FOUND);
      }

      const requesterIsSessionOwner = permissionHelpers._isSessionOwner(session, requesterId);
      if (participant.userId === session.ownerId && !requesterIsSessionOwner) {
        throw new AppError(ERROR_CODES.SESSION_OWNER_REMOVAL_FORBIDDEN);
      }

      if (participant.role === 'GM') {
        const canManageGm = permissionHelpers._isSessionOwner(session, requesterId)
          || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

        if (!canManageGm) {
          throw new AppError(ERROR_CODES.SESSION_GM_REMOVAL_OWNER_ONLY);
        }

        if (session.status !== 'PLANNED') {
          throw new AppError(ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE);
        }

        if (participant.userId === session.ownerId) {
          throw new AppError(ERROR_CODES.SESSION_OWNER_GM_ROLE_REMOVAL_FORBIDDEN);
        }
      } else if (!permissionHelpers._canManageParticipants(session, requesterId)) {
        throw new AppError(ERROR_CODES.SESSION_PARTICIPANTS_REMOVAL_OWNER_OR_CONFIRMED_GM_ONLY);
      }

      await prisma.$transaction(async (tx) => {
        await tx.sessionParticipant.delete({
          where: { id: parseId(participantId) },
        });

        const decPrice = new Prisma.Decimal(session.price || 0);
        if (participant.role === 'PLAYER' && (participant.status === 'PENDING' || participant.status === 'CONFIRMED') && decPrice.gt(0)) {
          await walletService.refundFunds(participant.userId, session.id, decPrice, tx);

          await tx.session.update({
            where: { id: session.id },
            data: {
              heldAmount: { decrement: decPrice },
            },
          });
        }
      });
    },

    async kickGm(sessionId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContextFn(sessionId, requesterId, preloadedSession);

      const canKickGm = permissionHelpers._isSessionOwner(session, requesterId)
        || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

      if (!canKickGm) {
        throw new AppError(ERROR_CODES.SESSION_GM_KICK_OWNER_ONLY);
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE);
      }

      const confirmedGm = permissionHelpers._getConfirmedGm(session);

      if (!confirmedGm) {
        throw new AppError(ERROR_CODES.SESSION_NO_CONFIRMED_GM);
      }

      if (confirmedGm.userId === session.ownerId) {
        throw new AppError(ERROR_CODES.SESSION_OWNER_GM_KICK_FORBIDDEN);
      }

      await prisma.sessionParticipant.delete({
        where: { id: confirmedGm.id },
      });

      return { success: true };
    },
  };
}

module.exports = createSessionParticipantsService;
