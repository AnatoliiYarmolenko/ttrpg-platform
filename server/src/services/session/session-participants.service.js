const VALID_PARTICIPANT_STATUSES = ['PENDING', 'CONFIRMED', 'DECLINED'];
const JOINABLE_SESSION_STATUSES = ['PLANNED'];

function parseId(value) {
  return parseInt(value, 10);
}

function normalizeJoinRole(role, AppError, ERROR_CODES) {
  const normalizedRole = String(role || 'PLAYER').toUpperCase();

  if (!['PLAYER', 'GM'].includes(normalizedRole)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Invalid role for join request');
  }

  return normalizedRole;
}

function assertJoinableSession(session, AppError, ERROR_CODES) {
  if (!JOINABLE_SESSION_STATUSES.includes(session.status)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      `Cannot join a session with status ${session.status}`
    );
  }

  if (session.campaign?.status === 'FINISHED') {
    throw new AppError(
      ERROR_CODES.CAMPAIGN_FINISHED,
      'Cannot join a session in a finished campaign'
    );
  }

  if (new Date(session.date) < new Date()) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      'Cannot join a session that has already started'
    );
  }
}

async function assertUserNotJoinedYet({ prisma, sessionId, userId, AppError, ERROR_CODES }) {
  const existingParticipant = await prisma.sessionParticipant.findUnique({
    where: {
      userId_sessionId: { userId, sessionId: parseId(sessionId) },
    },
  });

  if (existingParticipant) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'User has already joined this session');
  }
}

function assertPlayerCapacity({ normalizedRole, session, AppError, ERROR_CODES }) {
  if (normalizedRole !== 'PLAYER') {
    return;
  }

  const playerCount = session.participants.filter((participant) => participant.role === 'PLAYER').length;
  if (playerCount >= session.maxPlayers) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'No free player slots are available');
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
    throw new AppError(
      ERROR_CODES.SECURITY_ACCESS_DENIED,
      'Only campaign members can join a private campaign session as players'
    );
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
  if (!VALID_PARTICIPANT_STATUSES.includes(status)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Invalid participant status');
  }
}

function assertSessionIsActiveForParticipantManagement(session, AppError, ERROR_CODES) {
  if (['FINISHED', 'CANCELED'].includes(session.status)) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      'Participant management is unavailable for finished or canceled sessions'
    );
  }
}

async function findParticipantOrThrow({ prisma, participantId, sessionId, AppError, ERROR_CODES }) {
  const participant = await prisma.sessionParticipant.findUnique({
    where: { id: parseId(participantId) },
  });

  if (!participant || participant.sessionId !== parseId(sessionId)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Participant not found');
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
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      'Only pending participants can be declined'
    );
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
    throw new Error('Session participants service requires session query dependencies');
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
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'User is not a participant of this session');
      }

      if (['FINISHED', 'CANCELED'].includes(participant.session.status)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Cannot leave a finished or canceled session'
        );
      }

      if (participant.session.status === 'ACTIVE') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'The session is already active, leaving is not allowed'
        );
      }

      if (participant.role === 'GM' && participant.session.ownerId === userId) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'The owner GM cannot leave the session');
      }

      await prisma.sessionParticipant.delete({
        where: {
          userId_sessionId: { userId, sessionId: parseId(sessionId) },
        },
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
        });
      }

      if (participant.role === 'GM') {
        if (!permissionHelpers._isSessionOwner(session, requesterId)) {
          throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY, 'Only the owner can manage GM requests');
        }

        if (status === 'CONFIRMED') {
          return confirmGmParticipant({
            prisma,
            participantId,
            sessionId,
          });
        }
      } else if (!permissionHelpers._canManageParticipants(session, requesterId)) {
        throw new AppError(
          ERROR_CODES.SESSION_GM_ONLY,
          'Only a confirmed GM or the owner can manage players'
        );
      }

      return updateParticipantStatusRecord({ prisma, participantId, status });
    },

    async removeParticipant(sessionId, participantId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContextFn(sessionId, requesterId, preloadedSession);

      if (['FINISHED', 'CANCELED'].includes(session.status)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Participant removal is unavailable for finished or canceled sessions'
        );
      }

      const participant = await prisma.sessionParticipant.findUnique({
        where: { id: parseId(participantId) },
      });

      if (!participant || participant.sessionId !== parseId(sessionId)) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Participant not found');
      }

      const requesterIsSessionOwner = permissionHelpers._isSessionOwner(session, requesterId);
      if (participant.userId === session.ownerId && !requesterIsSessionOwner) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'You cannot remove the session owner');
      }

      if (participant.role === 'GM') {
        const canManageGm = permissionHelpers._isSessionOwner(session, requesterId)
          || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

        if (!canManageGm) {
          throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY, 'Only the owner can remove a GM');
        }

        if (session.status !== 'PLANNED') {
          throw new AppError(
            ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE,
            'A GM can be removed only while the session is planned'
          );
        }

        if (participant.userId === session.ownerId) {
          throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Cannot remove the owner from the GM role');
        }
      } else if (!permissionHelpers._canManageParticipants(session, requesterId)) {
        throw new AppError(
          ERROR_CODES.SESSION_GM_ONLY,
          'Only a confirmed GM or the owner can remove participants'
        );
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
        throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY, 'Only the owner can remove the GM');
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE, 'A GM can be removed only while the session is planned');
      }

      const confirmedGm = permissionHelpers._getConfirmedGm(session);

      if (!confirmedGm) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'There is no confirmed GM in this session');
      }

      if (confirmedGm.userId === session.ownerId) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Cannot remove the owner GM');
      }

      await prisma.sessionParticipant.delete({
        where: { id: confirmedGm.id },
      });

      return { success: true };
    },
  };
}

module.exports = createSessionParticipantsService;
