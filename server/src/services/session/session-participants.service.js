function createSessionParticipantsService({
  prisma,
  AppError,
  ERROR_CODES,
  getSessionById,
  resolveSessionContext,
  assertNoSessionTimeConflict,
  permissionHelpers,
}) {
  return {
    async joinSession(sessionId, userId, options = {}) {
      const { role = 'PLAYER' } = options;
      const session = await getSessionById(sessionId, userId);

      const normalizedRole = String(role || 'PLAYER').toUpperCase();

      if (!['PLAYER', 'GM'].includes(normalizedRole)) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невалідна роль для заявки');
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          `Не можна приєднатися до сесії зі статусом ${session.status}`
        );
      }

      if (session.campaign?.status === 'FINISHED') {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_FINISHED,
          'Не можна приєднатися до сесії в завершеній кампанії'
        );
      }

      if (new Date(session.date) < new Date()) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Не можна приєднатися до сесії, яка вже минула'
        );
      }

      const existingParticipant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: { userId, sessionId: parseInt(sessionId) },
        },
      });

      if (existingParticipant) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Ви вже приєднані до цієї сесії');
      }

      await assertNoSessionTimeConflict(userId, session.date, session.duration, {
        excludeSessionId: session.id,
        conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER,
      });

      if (normalizedRole === 'PLAYER') {
        const playerCount = session.participants.filter((participant) => participant.role === 'PLAYER').length;
        if (playerCount >= session.maxPlayers) {
          throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Місць у сесії більше немає');
        }
      }

      if (normalizedRole === 'GM') {
        const confirmedGm = permissionHelpers._getConfirmedGm(session);
        if (confirmedGm) {
          throw new AppError(ERROR_CODES.SESSION_GM_ALREADY_EXISTS);
        }
      }

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
          'Для звичайної сесії кампанії спочатку потрібно бути учасником кампанії'
        );
      }

      let status = 'PENDING';
      if (normalizedRole === 'PLAYER') {
        if (!isCampaignSession && session.visibility === 'PUBLIC') {
          // One-shot: публічні сесії підтверджуються автоматично.
          status = 'CONFIRMED';
        }

        if (isCampaignSession && session.visibility === 'PRIVATE' && isCampaignMember) {
          // Кампанійна "звичайна" сесія: члени кампанії входять одразу.
          status = 'CONFIRMED';
        }

        if (isCampaignSession && session.visibility === 'PUBLIC') {
          // Кампанійна "гостьова" сесія: вхід через підтвердження.
          status = 'PENDING';
        }
      }

      const isGuest = normalizedRole === 'PLAYER'
        && isCampaignSession
        && session.visibility === 'PUBLIC'
        && !isCampaignMember;

      const participant = await prisma.sessionParticipant.create({
        data: {
          userId,
          sessionId: parseInt(sessionId),
          role: normalizedRole,
          status,
          isGuest,
        },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      return participant;
    },

    async leaveSession(sessionId, userId) {
      const participant = await prisma.sessionParticipant.findUnique({
        where: {
          userId_sessionId: { userId, sessionId: parseInt(sessionId) },
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
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Ви не є учасником цієї сесії');
      }

      if (['FINISHED', 'CANCELED'].includes(participant.session.status)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Не можна вийти з завершеної або скасованої сесії'
        );
      }

      if (participant.session.status === 'ACTIVE') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Гра вже триває, вихід неможливий'
        );
      }

      if (participant.role === 'GM' && participant.session.ownerId === userId) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'GM не може вийти з власної сесії');
      }

      await prisma.sessionParticipant.delete({
        where: {
          userId_sessionId: { userId, sessionId: parseInt(sessionId) },
        },
      });
    },

    async getSessionParticipants(sessionId, userId = null) {
      const session = await getSessionById(sessionId, userId);
      return session.participants;
    },

    async updateParticipantStatus(sessionId, participantId, requesterId, status, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContext(sessionId, requesterId, preloadedSession);

      const validStatuses = ['PENDING', 'CONFIRMED', 'DECLINED'];
      if (!validStatuses.includes(status)) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невалідний статус учасника');
      }

      if (['FINISHED', 'CANCELED'].includes(session.status)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Не можна змінювати статус учасника для завершеної або скасованої сесії'
        );
      }

      const participant = await prisma.sessionParticipant.findUnique({
        where: { id: parseInt(participantId) },
      });

      if (!participant || participant.sessionId !== parseInt(sessionId)) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Учасник не знайдений');
      }

      // Rejection flow means removing the pending application instead of storing DECLINED.
      if (status === 'DECLINED') {
        if (participant.status !== 'PENDING') {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            'Відхиляти можна тільки заявки зі статусом PENDING'
          );
        }

        await prisma.sessionParticipant.delete({
          where: { id: parseInt(participantId) },
        });

        return {
          ...participant,
          status: 'DECLINED',
        };
      }

      const sessionIdInt = parseInt(sessionId);
      const participantIdInt = parseInt(participantId);

      if (participant.role === 'GM') {
        if (!permissionHelpers._isSessionOwner(session, requesterId)) {
          throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY, 'Тільки власник сесії може керувати заявками GM');
        }

        if (status === 'CONFIRMED') {
          const [updatedParticipant] = await prisma.$transaction([
            prisma.sessionParticipant.update({
              where: { id: participantIdInt },
              data: { status },
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
      } else if (!permissionHelpers._canManageParticipants(session, requesterId)) {
        throw new AppError(
          ERROR_CODES.SESSION_GM_ONLY,
          'Тільки підтверджений GM або власник може керувати гравцями'
        );
      }

      const updated = await prisma.sessionParticipant.update({
        where: { id: participantIdInt },
        data: { status },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      return updated;
    },

    async removeParticipant(sessionId, participantId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContext(sessionId, requesterId, preloadedSession);

      if (['FINISHED', 'CANCELED'].includes(session.status)) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Не можна видаляти учасників із завершеної сесії'
        );
      }

      const participant = await prisma.sessionParticipant.findUnique({
        where: { id: parseInt(participantId) },
      });

      if (!participant || participant.sessionId !== parseInt(sessionId)) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Учасник не знайдений');
      }

      const requesterIsSessionOwner = permissionHelpers._isSessionOwner(session, requesterId);
      if (participant.userId === session.ownerId && !requesterIsSessionOwner) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Майстер не може видаляти власника сесії');
      }

      if (participant.role === 'GM') {
        const canManageGm = permissionHelpers._isSessionOwner(session, requesterId)
          || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

        if (!canManageGm) {
          throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY, 'Тільки власник сесії може керувати GM');
        }

        if (session.status !== 'PLANNED') {
          throw new AppError(
            ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE,
            'Керувати роллю GM можна тільки для запланованої сесії'
          );
        }

        if (participant.userId === session.ownerId) {
          throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Не можна видаляти Owner з ролі GM');
        }
      } else if (!permissionHelpers._canManageParticipants(session, requesterId)) {
        throw new AppError(
          ERROR_CODES.SESSION_GM_ONLY,
          'Тільки підтверджений GM або власник може видаляти учасників'
        );
      }

      await prisma.sessionParticipant.delete({
        where: { id: parseInt(participantId) },
      });
    },

    async kickGm(sessionId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await resolveSessionContext(sessionId, requesterId, preloadedSession);

      const canKickGm = permissionHelpers._isSessionOwner(session, requesterId)
        || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

      if (!canKickGm) {
        throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY, 'Тільки власник сесії може кікнути GM');
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE, 'Кікнути GM можна тільки для запланованої сесії');
      }

      const confirmedGm = permissionHelpers._getConfirmedGm(session);

      if (!confirmedGm) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'У сесії немає підтвердженого GM');
      }

      if (confirmedGm.userId === session.ownerId) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Неможливо кікнути GM, якщо ним є власник сесії');
      }

      await prisma.sessionParticipant.delete({
        where: { id: confirmedGm.id },
      });

      return { success: true };
    },
  };
}

module.exports = createSessionParticipantsService;