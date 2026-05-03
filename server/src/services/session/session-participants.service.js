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
}) {
  if (participant.status !== 'PENDING') {
    throw new AppError(ERROR_CODES.SESSION_PARTICIPANT_DECLINE_PENDING_ONLY);
  }

  await prisma.sessionParticipant.delete({
    where: { id: parseId(participantId) },
  });

  return {
    ...participant,
    status: 'DECLINED',
  };
}

async function confirmGmParticipant({
  prisma,
  participantId,
  sessionId,
}) {
  const participantIdInt = parseId(participantId);
  const sessionIdInt = parseId(sessionId);

  const [updatedParticipant] = await prisma.$transaction([
    prisma.sessionParticipant.update({
      where: { id: participantIdInt },
      data: { status: 'CONFIRMED' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    }),
    prisma.sessionParticipant.deleteMany({
      where: {
        sessionId: sessionIdInt,
        role: 'GM',
        status: 'PENDING',
        NOT: { id: participantIdInt },
      },
    }),
  ]);

  return updatedParticipant;
}

async function updateParticipantStatusRecord({ prisma, participantId, status }) {
  return prisma.sessionParticipant.update({
    where: { id: parseId(participantId) },
    data: { status },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
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

      return prisma.sessionParticipant.create({
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
    },

    async leaveSession(sessionId, userId) {
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: { userId, sessionId: parseId(sessionId) },
        },
        include: {
          session: {
            select: {
              ownerId: true,
              status: true,
              date: true,
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

      await prisma.sessionParticipant.delete({
        where: {
          userId_sessionId: { userId, sessionId: parseId(sessionId) },
        },
      });

      return participant;
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

      return updateParticipantStatusRecord({ prisma, participantId, status });
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

      await prisma.sessionParticipant.delete({
        where: { id: parseId(participantId) },
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
