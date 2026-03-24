function createSessionLifecycleService({
  prisma,
  AppError,
  ERROR_CODES,
  permissionHelpers,
  datetimeHelpers,
  sessionQueryService,
  createRawEncryptedAndHashedShareToken,
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

      if (hasSettingsUpdate && session.campaign?.status === 'FINISHED') {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_FINISHED,
          'Cannot update session settings in a finished campaign'
        );
      }

      if (hasStatusUpdate && !permissionHelpers._canChangeSessionStatus(session, requesterId)) {
        throw new AppError(ERROR_CODES.SESSION_GM_ONLY);
      }

      if (isSessionInPast && hasSettingsUpdate) {
        if (!hasStatusUpdate) {
          throw new AppError(
            ERROR_CODES.VALIDATION_FAILED,
            'Cannot update the settings of a session that already happened'
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

        const confirmedParticipants = session.participants.filter(
          (participant) => participant.status === 'CONFIRMED' && participant.userId !== session.ownerId
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
            if (conflictError.code === ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER) {
              participantsWithConflicts.push(participant);
            } else {
              throw conflictError;
            }
          }
        }

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
            `Invalid status transition: ${session.status} -> ${nextStatus}`
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
      const targetVisibility = hasField('visibility')
        ? normalizedUpdateData.visibility
        : session.visibility;
      if (session.campaignId && targetVisibility === 'LINK_ONLY') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'LINK_ONLY is allowed only for one-shot sessions'
        );
      }
      const isEnteringLinkOnly = targetVisibility === 'LINK_ONLY' && session.visibility !== 'LINK_ONLY';
      const isLeavingLinkOnly = targetVisibility !== 'LINK_ONLY' && session.visibility === 'LINK_ONLY';
      const needsInitialLinkOnlyToken = targetVisibility === 'LINK_ONLY' && !session.shareTokenHash;
      const shareTokenData = (isEnteringLinkOnly || needsInitialLinkOnlyToken)
        ? createRawEncryptedAndHashedShareToken()
        : null;

      const sessionIdInt = sessionQueryService.parsePositiveInt(sessionId, 'Session ID');

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
            shareTokenHash: shareTokenData
              ? shareTokenData.tokenHash
              : (isLeavingLinkOnly ? null : undefined),
            shareTokenEncrypted: shareTokenData
              ? shareTokenData.tokenEncrypted
              : (isLeavingLinkOnly ? null : undefined),
            shareTokenCreatedAt: shareTokenData
              ? new Date()
              : (isLeavingLinkOnly ? null : undefined),
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

      if (shareTokenData) {
        updated.shareToken = shareTokenData.rawToken;
      }

      delete updated.shareTokenHash;
      delete updated.shareTokenEncrypted;
      delete updated.shareTokenCreatedAt;

      return updated;
    },

    async deleteSession(sessionId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, requesterId, preloadedSession);

      const canDelete = permissionHelpers._isSessionOwner(session, requesterId)
        || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

      if (!canDelete) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'You do not have permission to delete this session');
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(
          ERROR_CODES.SESSION_DELETE_FORBIDDEN,
          'Only planned sessions can be deleted'
        );
      }

      await prisma.session.delete({
        where: { id: sessionQueryService.parsePositiveInt(sessionId, 'Session ID') },
      });
    },

    async cancelSession(sessionId, userId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, userId, preloadedSession);

      if (session.status === 'FINISHED') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Cannot cancel a finished session'
        );
      }

      if (session.status === 'CANCELED') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Session is already canceled'
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
          ? 'Only a confirmed GM, the session owner, or the campaign owner can cancel an active session'
          : 'Only the session owner or campaign owner can cancel this session';
        throw new AppError(errorCode, message);
      }

      const updatedSession = await prisma.session.update({
        where: { id: sessionQueryService.parsePositiveInt(sessionId, 'Session ID') },
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
