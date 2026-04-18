const SESSION_SETTINGS_FIELDS = [
  'title',
  'description',
  'date',
  'duration',
  'maxPlayers',
  'price',
  'visibility',
  'system',
];

const ALLOWED_STATUS_TRANSITIONS = {
  PLANNED: ['ACTIVE', 'FINISHED', 'CANCELED'],
  ACTIVE: ['FINISHED', 'CANCELED'],
  FINISHED: [],
  CANCELED: [],
};

function hasOwnField(data, field) {
  return Object.hasOwn(data, field);
}

function buildSessionUpdateMeta(session, normalizedUpdateData) {
  const sessionDate = new Date(session.date);

  return {
    sessionDate,
    isSessionInPast:
      !Number.isNaN(sessionDate.getTime()) && sessionDate.getTime() < Date.now(),
    hasSettingsUpdate: SESSION_SETTINGS_FIELDS.some((field) => hasOwnField(normalizedUpdateData, field)),
    hasStatusUpdate: hasOwnField(normalizedUpdateData, 'status'),
  };
}

function assertSessionUpdatePermissions({
  session,
  requesterId,
  updateMeta,
  permissionHelpers,
  AppError,
  ERROR_CODES,
}) {
  if (updateMeta.hasSettingsUpdate && !permissionHelpers._canEditSessionSettings(session, requesterId)) {
    throw new AppError(ERROR_CODES.SESSION_OWNER_ONLY);
  }

  if (updateMeta.hasSettingsUpdate && ['FINISHED', 'CANCELED'].includes(session.status)) {
    throw new AppError(ERROR_CODES.SESSION_SETTINGS_UPDATE_FORBIDDEN);
  }

  if (updateMeta.hasSettingsUpdate && session.campaign?.status === 'FINISHED') {
    throw new AppError(ERROR_CODES.CAMPAIGN_FINISHED);
  }

  if (updateMeta.hasStatusUpdate && !permissionHelpers._canChangeSessionStatus(session, requesterId)) {
    throw new AppError(ERROR_CODES.SESSION_GM_ONLY);
  }
}

function removePastSessionSettingsUpdates({
  normalizedUpdateData,
  updateMeta,
  AppError,
  ERROR_CODES,
}) {
  if (!updateMeta.isSessionInPast || !updateMeta.hasSettingsUpdate) {
    return;
  }

  if (!updateMeta.hasStatusUpdate) {
    throw new AppError(ERROR_CODES.SESSION_UPDATE_PAST_SETTINGS_FORBIDDEN);
  }

  SESSION_SETTINGS_FIELDS.forEach((field) => {
    delete normalizedUpdateData[field];
  });
}

function resolveTargetTiming(session, normalizedUpdateData) {
  const hasDateChange = normalizedUpdateData.date !== undefined;
  const hasDurationChange = normalizedUpdateData.duration !== undefined;

  return {
    hasDateChange,
    hasDurationChange,
    targetDate: hasDateChange ? normalizedUpdateData.date : session.date,
    targetDuration: hasDurationChange ? normalizedUpdateData.duration : session.duration,
  };
}

async function assertOwnerTimeConflict({
  prisma,
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  session,
  targetDate,
  targetDuration,
}) {
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
}

async function collectConflictingParticipantIds({
  prisma,
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  session,
  targetDate,
  targetDuration,
}) {
  const confirmedParticipants = session.participants.filter(
    (participant) => participant.status === 'CONFIRMED' && participant.userId !== session.ownerId
  );
  const conflictingParticipantIds = [];

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
      if (conflictError.code !== ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER) {
        throw conflictError;
      }

      conflictingParticipantIds.push(participant.id);
    }
  }

  return conflictingParticipantIds;
}

async function resolveTimingConflicts({
  prisma,
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  session,
  normalizedUpdateData,
}) {
  const timing = resolveTargetTiming(session, normalizedUpdateData);

  if (!timing.hasDateChange && !timing.hasDurationChange) {
    return [];
  }

  await assertOwnerTimeConflict({
    prisma,
    AppError,
    ERROR_CODES,
    datetimeHelpers,
    session,
    targetDate: timing.targetDate,
    targetDuration: timing.targetDuration,
  });

  return collectConflictingParticipantIds({
    prisma,
    AppError,
    ERROR_CODES,
    datetimeHelpers,
    session,
    targetDate: timing.targetDate,
    targetDuration: timing.targetDuration,
  });
}

function assertValidStatusTransition({
  session,
  nextStatus,
  AppError,
  ERROR_CODES,
}) {
  if (!nextStatus || nextStatus === session.status) {
    return;
  }

  const allowedNextStatuses = ALLOWED_STATUS_TRANSITIONS[session.status] || [];
  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new AppError(ERROR_CODES.SESSION_STATUS_TRANSITION_INVALID, null, {
      fromStatus: session.status,
      toStatus: nextStatus,
    });
  }
}

async function assertPlannedToActiveTransitionAllowed({
  prisma,
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  requesterId,
  sessionDate,
}) {
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

function assertPlannedToFinishedTransitionAllowed({
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  session,
}) {
  const now = new Date();
  const finishAllowedAt = datetimeHelpers._getSessionEndWithGrace(session.date, session.duration, 2);

  if (now < finishAllowedAt) {
    throw new AppError(ERROR_CODES.SESSION_MARK_FINISHED_TOO_EARLY);
  }
}

async function assertStatusTransitionRules({
  prisma,
  AppError,
  ERROR_CODES,
  datetimeHelpers,
  session,
  requesterId,
  normalizedUpdateData,
  sessionDate,
}) {
  const nextStatus = normalizedUpdateData.status;

  assertValidStatusTransition({ session, nextStatus, AppError, ERROR_CODES });

  if (session.status === 'PLANNED' && nextStatus === 'ACTIVE') {
    await assertPlannedToActiveTransitionAllowed({
      prisma,
      AppError,
      ERROR_CODES,
      datetimeHelpers,
      requesterId,
      sessionDate,
    });
  }

  if (session.status === 'PLANNED' && nextStatus === 'FINISHED') {
    assertPlannedToFinishedTransitionAllowed({
      AppError,
      ERROR_CODES,
      datetimeHelpers,
      session,
    });
  }
}

function resolveShareTokenState({
  session,
  normalizedUpdateData,
  createRawEncryptedAndHashedShareToken,
  AppError,
  ERROR_CODES,
}) {
  const targetVisibility = hasOwnField(normalizedUpdateData, 'visibility')
    ? normalizedUpdateData.visibility
    : session.visibility;

  if (session.campaignId && targetVisibility === 'LINK_ONLY') {
    throw new AppError(ERROR_CODES.SESSION_LINK_ONLY_ONE_SHOT_ONLY);
  }

  const isEnteringLinkOnly = targetVisibility === 'LINK_ONLY' && session.visibility !== 'LINK_ONLY';
  const isLeavingLinkOnly = targetVisibility !== 'LINK_ONLY' && session.visibility === 'LINK_ONLY';
  const needsInitialLinkOnlyToken = targetVisibility === 'LINK_ONLY' && !session.shareTokenHash;
  const shouldCreateShareToken = isEnteringLinkOnly || needsInitialLinkOnlyToken;

  return {
    isLeavingLinkOnly,
    shareTokenData: shouldCreateShareToken
      ? createRawEncryptedAndHashedShareToken()
      : null,
  };
}

function resolveShareTokenFieldValue({ shareTokenData, isLeavingLinkOnly, field }) {
  if (shareTokenData) {
    return shareTokenData[field];
  }

  return isLeavingLinkOnly ? null : undefined;
}

function buildSessionUpdatePayload({
  normalizedUpdateData,
  shareTokenState,
}) {
  const shareTokenCreatedAt = shareTokenState.shareTokenData
    ? new Date()
    : undefined;

  const shareTokenCreatedAtValue = shareTokenState.isLeavingLinkOnly
    ? null
    : shareTokenCreatedAt;

  return {
    title: hasOwnField(normalizedUpdateData, 'title') ? normalizedUpdateData.title : undefined,
    description: hasOwnField(normalizedUpdateData, 'description') ? normalizedUpdateData.description : undefined,
    date: hasOwnField(normalizedUpdateData, 'date') ? normalizedUpdateData.date : undefined,
    duration: hasOwnField(normalizedUpdateData, 'duration') ? normalizedUpdateData.duration : undefined,
    maxPlayers: hasOwnField(normalizedUpdateData, 'maxPlayers') ? normalizedUpdateData.maxPlayers : undefined,
    price: hasOwnField(normalizedUpdateData, 'price') ? normalizedUpdateData.price : undefined,
    visibility: hasOwnField(normalizedUpdateData, 'visibility') ? normalizedUpdateData.visibility : undefined,
    shareTokenHash: resolveShareTokenFieldValue({
      shareTokenData: shareTokenState.shareTokenData,
      isLeavingLinkOnly: shareTokenState.isLeavingLinkOnly,
      field: 'tokenHash',
    }),
    shareTokenEncrypted: resolveShareTokenFieldValue({
      shareTokenData: shareTokenState.shareTokenData,
      isLeavingLinkOnly: shareTokenState.isLeavingLinkOnly,
      field: 'tokenEncrypted',
    }),
    shareTokenCreatedAt: shareTokenCreatedAtValue,
    status: hasOwnField(normalizedUpdateData, 'status') ? normalizedUpdateData.status : undefined,
    system: hasOwnField(normalizedUpdateData, 'system') ? normalizedUpdateData.system : undefined,
  };
}

function attachPublicShareToken(updatedSession, shareTokenState) {
  if (shareTokenState.shareTokenData) {
    updatedSession.shareToken = shareTokenState.shareTokenData.rawToken;
  }

  delete updatedSession.shareTokenHash;
  delete updatedSession.shareTokenEncrypted;
  delete updatedSession.shareTokenCreatedAt;

  return updatedSession;
}

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
      const updateMeta = buildSessionUpdateMeta(session, normalizedUpdateData);

      assertSessionUpdatePermissions({
        session,
        requesterId,
        updateMeta,
        permissionHelpers,
        AppError,
        ERROR_CODES,
      });

      removePastSessionSettingsUpdates({
        normalizedUpdateData,
        updateMeta,
        AppError,
        ERROR_CODES,
      });

      const conflictingParticipantIds = await resolveTimingConflicts({
        prisma,
        AppError,
        ERROR_CODES,
        datetimeHelpers,
        session,
        normalizedUpdateData,
      });

      await assertStatusTransitionRules({
        prisma,
        AppError,
        ERROR_CODES,
        datetimeHelpers,
        session,
        requesterId,
        normalizedUpdateData,
        sessionDate: updateMeta.sessionDate,
      });

      const shareTokenState = resolveShareTokenState({
        session,
        normalizedUpdateData,
        createRawEncryptedAndHashedShareToken,
        AppError,
        ERROR_CODES,
      });
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
          data: buildSessionUpdatePayload({
            normalizedUpdateData,
            shareTokenState,
          }),
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

      return attachPublicShareToken(updated, shareTokenState);
    },

    async deleteSession(sessionId, requesterId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, requesterId, preloadedSession);

      const canDelete = permissionHelpers._isSessionOwner(session, requesterId)
        || permissionHelpers._isCampaignOwnerOverride(session, requesterId);

      if (!canDelete) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED);
      }

      if (session.status !== 'PLANNED') {
        throw new AppError(ERROR_CODES.SESSION_DELETE_FORBIDDEN);
      }

      await prisma.session.delete({
        where: { id: sessionQueryService.parsePositiveInt(sessionId, 'Session ID') },
      });
    },

    async cancelSession(sessionId, userId, options = {}) {
      const { preloadedSession = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, userId, preloadedSession);

      if (session.status === 'FINISHED') {
        throw new AppError(ERROR_CODES.SESSION_CANCEL_FINISHED_FORBIDDEN);
      }

      if (session.status === 'CANCELED') {
        throw new AppError(ERROR_CODES.SESSION_ALREADY_CANCELED);
      }

      const isOwner = permissionHelpers._isSessionOwner(session, userId);
      const isCampaignOwner = permissionHelpers._isCampaignOwnerOverride(session, userId);
      const isConfirmedGm = permissionHelpers._canChangeSessionStatus(session, userId);
      const canCancel = isOwner || isCampaignOwner || (session.status === 'ACTIVE' && isConfirmedGm);

      if (!canCancel) {
        const errorCode = session.status === 'ACTIVE'
          ? ERROR_CODES.SESSION_GM_ONLY
          : ERROR_CODES.SESSION_OWNER_ONLY;
        throw new AppError(errorCode);
      }

      return prisma.session.update({
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
    },

    async markSessionAsFinished(sessionId, userId, options = {}) {
      return this.updateSession(sessionId, userId, { status: 'FINISHED' }, options);
    },
  };
}

module.exports = createSessionLifecycleService;
