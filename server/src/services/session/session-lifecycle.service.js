function createSessionLifecycleService({
  prisma,
  AppError,
  ERROR_CODES,
  permissionHelpers,
  datetimeHelpers,
  sessionQueryService,
}) {
  return {
    async updateSession(sessionId, requesterId, updateData, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, requesterId, preloadedSession);
      const normalizedUpdateData = { ...updateData };

      const sessionDate = new Date(session.date);
      const isSessionInPast =
        !Number.isNaN(sessionDate.getTime()) && sessionDate.getTime() < Date.now();
      const settingsFields = [
        'title',
        'description',
        'date',
        'duration',
        'maxPlayers',
        'price',
        'visibility',
        'system',
      ];
      const hasSettingsUpdate = settingsFields.some((field) =>
        Object.prototype.hasOwnProperty.call(normalizedUpdateData, field)
      );
      const hasStatusUpdate = Object.prototype.hasOwnProperty.call(
        normalizedUpdateData,
        'status'
      );

      if (hasSettingsUpdate && !permissionHelpers._canEditSessionSettings(session, requesterId)) {
        throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY);
      }

      if (
        session.campaignId
        && normalizedUpdateData.visibility === 'LINK_ONLY'
      ) {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Для сесії в кампанії тип "LINK_ONLY" більше не підтримується'
        );
      }

      if (hasSettingsUpdate && session.campaign?.status === 'FINISHED') {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_FINISHED,
          'Неможливо змінювати налаштування сесії в завершеній кампанії'
        );
      }

      if (hasStatusUpdate && !permissionHelpers._canChangeSessionStatus(session, requesterId)) {
        throw new AppError(ERROR_CODES.SESSION_GM_ONLY);
      }

      if (isSessionInPast && hasSettingsUpdate) {
        if (!hasStatusUpdate) {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            'Неможливо змінювати налаштування сесії, яка вже відбулася'
          );
        }

        settingsFields.forEach((field) => {
          delete normalizedUpdateData[field];
        });
      }

      const hasDateChange = normalizedUpdateData.date !== undefined;
      const hasDurationChange = normalizedUpdateData.duration !== undefined;
      let conflictingParticipantIds = [];

      if (hasDateChange || hasDurationChange) {
        const targetDate = hasDateChange ? normalizedUpdateData.date : session.date;
        const targetDuration = hasDurationChange ? normalizedUpdateData.duration : session.duration;

        // Перевіряємо конфлікт для owner
        await datetimeHelpers._assertNoSessionTimeConflict(
          { prisma, AppError, ERROR_CODES },
          session.ownerId,
          targetDate,
          targetDuration,
          {
            excludeSessionId: session.id,
            conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_OWNER,
          }
        );

        // Перевіряємо конфлікт для всіх CONFIRMED учасників
        // Якщо конфлікт існує — знімаємо підтвердження і переводимо у PENDING
        const confirmedParticipants = session.participants.filter(
          (p) => p.status === 'CONFIRMED' && p.userId !== session.ownerId
        );

        const participantsWithConflicts = [];

        for (const participant of confirmedParticipants) {
          try {
            await datetimeHelpers._assertNoSessionTimeConflict(
              { prisma, AppError, ERROR_CODES },
              participant.userId,
              targetDate,
              targetDuration,
              {
                excludeSessionId: session.id,
                conflictErrorCode: ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER,
              }
            );
          } catch (conflictError) {
            // Якщо виникла помилка конфлікту часу — помітимо учасника
            if (conflictError.code === ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER) {
              participantsWithConflicts.push(participant);
            } else {
              throw conflictError;
            }
          }
        }

        // Якщо є конфлікти — знімаємо підтвердження з конфліктуючих учасників
        conflictingParticipantIds = participantsWithConflicts.map((participant) => participant.id);
      }

      const nextStatus = normalizedUpdateData.status;
      const isPlannedToActiveTransition = session.status === 'PLANNED' && nextStatus === 'ACTIVE';
      const isPlannedToFinishedTransition = session.status === 'PLANNED' && nextStatus === 'FINISHED';

      if (nextStatus && nextStatus !== session.status) {
        const allowedStatusTransitions = {
          PLANNED: ['ACTIVE', 'FINISHED', 'CANCELED'],
          ACTIVE: ['FINISHED', 'CANCELED'],
          FINISHED: [],
          CANCELED: [],
        };

        const allowedNextStatuses = allowedStatusTransitions[session.status] || [];
        if (!allowedNextStatuses.includes(nextStatus)) {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            `Невалідний перехід статусу: ${session.status} → ${nextStatus}`
          );
        }
      }

      if (isPlannedToActiveTransition) {
        const now = new Date();
        const requester = await prisma.user.findUnique({
          where: { id: requesterId },
          select: { timezone: true },
        });
        const userTimeZone = requester?.timezone || 'Europe/Kyiv';

        if (!datetimeHelpers._isSameDayInTimeZone(now, sessionDate, userTimeZone)) {
          throw new AppError(ERROR_CODES.SESSION_START_ONLY_ON_SCHEDULED_DAY);
        }
      }

      if (isPlannedToFinishedTransition) {
        const now = new Date();
        const finishAllowedAt = datetimeHelpers._getSessionEndWithGrace(session.date, session.duration, 2);

        if (now < finishAllowedAt) {
          throw new AppError(ERROR_CODES.SESSION_MARK_FINISHED_TOO_EARLY);
        }
      }

      const hasField = (field) =>
        Object.prototype.hasOwnProperty.call(normalizedUpdateData, field);

      const sessionIdInt = sessionQueryService.parsePositiveInt(sessionId, 'ID сесії');

      const updated = await prisma.$transaction(async (tx) => {
        if (conflictingParticipantIds.length > 0) {
          await tx.sessionParticipant.updateMany({
            where: {
              id: { in: conflictingParticipantIds },
            },
            data: { status: 'PENDING' },
          });
        }

        return tx.session.update({
          where: { id: sessionIdInt },
          data: {
            title: hasField('title') ? normalizedUpdateData.title : undefined,
            description: hasField('description') ? normalizedUpdateData.description : undefined,
            date: hasField('date') ? normalizedUpdateData.date : undefined,
            duration: hasField('duration') ? normalizedUpdateData.duration : undefined,
            maxPlayers: hasField('maxPlayers') ? normalizedUpdateData.maxPlayers : undefined,
            price: hasField('price') ? normalizedUpdateData.price : undefined,
            visibility: hasField('visibility') ? normalizedUpdateData.visibility : undefined,
            status: hasField('status') ? normalizedUpdateData.status : undefined,
            system: hasField('system') ? normalizedUpdateData.system : undefined,
          },
          include: {
            owner: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            campaign: {
              select: { id: true, title: true, status: true, system: true },
            },
            participants: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
              },
            },
          },
        });
      });

      return updated;
    },

    async deleteSession(sessionId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, requesterId, preloadedSession);

      const canDelete = permissionHelpers._isSessionOwner(session, requesterId)
        || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

      if (!canDelete) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає прав на видалення сесії');
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(
          ERROR_CODES.SESSION_DELETE_FORBIDDEN,
          'Видаляти можна лише заплановані сесії'
        );
      }

      await prisma.session.delete({
        where: { id: sessionQueryService.parsePositiveInt(sessionId, 'ID сесії') },
      });
    },

    async cancelSession(sessionId, userId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, userId, preloadedSession);

      if (session.status === 'FINISHED') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Не можна скасувати вже завершену сесію'
        );
      }

      if (session.status === 'CANCELED') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Сесія вже скасована'
        );
      }

      const isOwner = permissionHelpers._isSessionOwner(session, userId);
      const isCampaignOwner = permissionHelpers._isCampaignOwnerOverride(session, userId);
      const isConfirmedGm = permissionHelpers._canChangeSessionStatus(session, userId);
      const canCancel = isOwner || isCampaignOwner || (session.status === 'ACTIVE' && isConfirmedGm);

      if (!canCancel) {
        const errorCode = session.status === 'ACTIVE'
          ? ERROR_CODES.SESSION_GM_ONLY
          : ERROR_CODES.SESSION_OWNER_ONLY;
        const message = session.status === 'ACTIVE'
          ? 'Скасувати ACTIVE сесію може тільки підтверджений GM, власник сесії або власник кампанії'
          : 'Скасувати сесію може тільки власник сесії або власник кампанії';
        throw new AppError(errorCode, message);
      }

      const updatedSession = await prisma.session.update({
        where: { id: sessionQueryService.parsePositiveInt(sessionId, 'ID сесії') },
        data: {
          status: 'CANCELED',
        },
        include: {
          owner: { select: { id: true, username: true } },
          participants: {
            include: {
              user: { select: { id: true, email: true, username: true } },
            },
          },
        },
      });

      return updatedSession;
    },

    async markSessionAsFinished(sessionId, userId, options = {}) {
      return this.updateSession(sessionId, userId, { status: 'FINISHED' }, options);
    },
  };
}

module.exports = createSessionLifecycleService;