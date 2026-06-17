const { Prisma } = require('@prisma/client');
const {
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} = require('../../constants/notification.constants');
const { vttStateManager } = require('../../vtt/vtt-state.manager');
const { callService } = require('../../call/call.service');
const { logger } = require('../../lib/logger');

const SESSION_SETTINGS_FIELDS = [
  'title',
  'description',
  'date',
  'duration',
  'maxPlayers',
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
  return Object.hasOwn(data, field) && data[field] !== undefined;
}

function getSessionTitle(session) {
  return session?.title || 'Нова сесія';
}

function formatSessionTime(session) {
  if (!session?.date) return 'невідомий час';
  const date = new Date(session.date);
  return date.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildScheduleSignature(session) {
  const dateValue = session?.date ? new Date(session.date).toISOString() : 'no-date';
  const durationValue = session?.duration ?? 'no-duration';

  return `${dateValue}:${durationValue}`;
}

async function createNotificationSafely(notificationService, payload, tx) {
  if (!notificationService?.createNotification) {
    return;
  }

  try {
    await notificationService.createNotification(payload, tx);
  } catch {
  }
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

async function collectConflictingParticipants({
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
  const conflictingParticipants = [];

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

      conflictingParticipants.push({
        id: participant.id,
        userId: participant.userId,
      });
    }
  }

  return conflictingParticipants;
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

  return collectConflictingParticipants({
    prisma,
    AppError,
    ERROR_CODES,
    datetimeHelpers,
    session,
    targetDate: timing.targetDate,
    targetDuration: timing.targetDuration,
  });
}

async function notifySessionRescheduled({
  notificationService,
  session,
  updatedSession,
  requesterId,
  tx,
}) {
  const scheduleSignature = buildScheduleSignature(updatedSession);
  const sessionTitle = getSessionTitle(updatedSession);

  await createNotificationSafely(notificationService, {
    eventKey: `session_rescheduled:${updatedSession.id}:${scheduleSignature}`,
    type: NotificationType.SESSION_RESCHEDULED,
    severity: NotificationSeverity.INFO,
    category: NotificationCategory.SESSION,
    title: 'Сесію перенесено',
    body: `Сесію "${sessionTitle}" перенесено. Перевірте новий час.`,
    link: `/session/${updatedSession.id}`,
    audience: ['session_confirmed_participants', 'session_pending_participants', 'session_owner'],
    context: { sessionId: updatedSession.id, excludeUserId: requesterId },
    dedupeKey: `session:${updatedSession.id}:rescheduled:${scheduleSignature}`,
    dedupeWindowMs: 15 * 60 * 1000,
    metadata: {
      sessionId: updatedSession.id,
      sessionTitle: updatedSession.title,
      date: updatedSession.date,
      duration: updatedSession.duration,
    },
  }, tx);
}

async function notifyConflictingParticipants({
  notificationService,
  session,
  updatedSession,
  conflictingParticipants,
  tx,
}) {
  if (!conflictingParticipants.length) {
    return;
  }

  const scheduleSignature = buildScheduleSignature(updatedSession);
  const newTime = formatSessionTime(updatedSession);

  await Promise.all(conflictingParticipants.map((participant) => createNotificationSafely(notificationService, {
    eventKey: `session_time_conflict:${session.id}:${participant.userId}:${scheduleSignature}`,
    type: NotificationType.SESSION_TIME_CONFLICT,
    severity: NotificationSeverity.WARNING,
    category: NotificationCategory.SESSION,
    title: 'Конфлікт часу',
    body: `Перенесено на ${newTime}. У вас вже є сесія на цей час.`,
    link: `/session/${session.id}`,
    recipientIds: [participant.userId],
    dedupeKey: `session:${session.id}:time_conflict:${participant.userId}:${scheduleSignature}`,
    dedupeWindowMs: 15 * 60 * 1000,
    metadata: {
      sessionId: session.id,
      sessionTitle: session.title,
      newDate: updatedSession.date,
      participantId: participant.id,
      userId: participant.userId,
    },
  }, tx)));
}



async function notifySessionCancelled({
  notificationService,
  session,
  requesterId,
  reason = null,
  tx,
}) {
  const sessionTitle = getSessionTitle(session);
  let title = 'Сесію скасовано';
  let body = `Сесію "${sessionTitle}" скасовано.`;

  if (reason === 'no_gm') {
    title = 'Гру скасовано: немає Майстра';
    body = `Сесію "${sessionTitle}" автоматично скасовано, оскільки жоден Майстер не підтвердив участь.`;
  } else if (reason === 'stale_planned') {
    title = 'Гру скасовано: застаріла';
    body = `Сесію "${sessionTitle}" автоматично скасовано через тривалу неактивність.`;
  } else if (reason === 'gm_forgot') {
    title = 'Гру скасовано: Майстер не з\'явився';
    body = `Сесію "${sessionTitle}" автоматично скасовано, оскільки Майстер не почав гру вчасно.`;
  }

  await createNotificationSafely(notificationService, {
    eventKey: `session_cancelled:${session.id}`,
    type: NotificationType.SESSION_CANCELLED,
    severity: NotificationSeverity.ERROR,
    category: NotificationCategory.SESSION,
    title,
    body,
    link: `/session/${session.id}`,
    audience: ['session_confirmed_participants', 'session_pending_participants'],
    context: { sessionId: session.id, excludeUserId: requesterId },
    metadata: {
      sessionId: session.id,
      sessionTitle: session.title,
      status: 'CANCELED',
      reason,
    },
  }, tx);
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

  updatedSession.startAt = updatedSession.date;

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
  notificationService = null,
  walletService,
}) {
  return {
    async updateSession(sessionId, requesterId, updateData, options = {}) {
      const { preloadedSession = null, bypassPermissions = false, tx: externalTx = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, requesterId, preloadedSession);
      const normalizedUpdateData = { ...updateData };

      if (normalizedUpdateData.status === 'CANCELED') {
        return this.cancelSession(sessionId, requesterId, options);
      }

      const updateMeta = buildSessionUpdateMeta(session, normalizedUpdateData);

      if (!bypassPermissions) {
        assertSessionUpdatePermissions({
          session,
          requesterId,
          updateMeta,
          permissionHelpers,
          AppError,
          ERROR_CODES,
        });
      }

      removePastSessionSettingsUpdates({
        normalizedUpdateData,
        updateMeta,
        AppError,
        ERROR_CODES,
      });

      const conflictingParticipants = await resolveTimingConflicts({
        prisma: externalTx || prisma,
        AppError,
        ERROR_CODES,
        datetimeHelpers,
        session,
        normalizedUpdateData,
      });

      await assertStatusTransitionRules({
        prisma: externalTx || prisma,
        AppError,
        ERROR_CODES,
        datetimeHelpers,
        session,
        requesterId,
        normalizedUpdateData,
        sessionDate: updateMeta.sessionDate,
      });

      const targetVisibility = hasOwnField(normalizedUpdateData, 'visibility')
        ? normalizedUpdateData.visibility
        : session.visibility;

      if (session.campaignId && targetVisibility === 'LINK_ONLY') {
        throw new AppError(ERROR_CODES.SESSION_LINK_ONLY_ONE_SHOT_ONLY);
      }

      const sessionIdInt = sessionQueryService.parsePositiveInt(sessionId, 'Session ID');

      const dateChanged = hasOwnField(normalizedUpdateData, 'date')
        && new Date(normalizedUpdateData.date).getTime() !== new Date(session.date).getTime();
      const durationChanged = hasOwnField(normalizedUpdateData, 'duration')
        && normalizedUpdateData.duration !== session.duration;
      const scheduleChanged = dateChanged || durationChanged;

      const executeUpdate = async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT visibility, "shareTokenHash", status, price, "heldAmount", "platformFeePercent" 
          FROM "Session" 
          WHERE id = ${sessionIdInt} 
          FOR UPDATE
        `;

        if (!rows || rows.length === 0) {
          throw new AppError(ERROR_CODES.SESSION_NOT_FOUND);
        }

        const lockedSession = rows[0];

        const shareTokenState = resolveShareTokenState({
          session: { ...session, visibility: lockedSession.visibility, shareTokenHash: lockedSession.shareTokenHash },
          normalizedUpdateData,
          createRawEncryptedAndHashedShareToken,
          AppError,
          ERROR_CODES,
        });

        let currentHeldAmount = new Prisma.Decimal(lockedSession.heldAmount || 0);

        if (['ACTIVE', 'FINISHED'].includes(normalizedUpdateData.status) && lockedSession.status !== normalizedUpdateData.status) {
          const pendingParticipants = tx.sessionParticipant?.findMany
            ? await tx.sessionParticipant.findMany({
                where: {
                  sessionId: sessionIdInt,
                  status: 'PENDING',
                },
              })
            : [];

          if (pendingParticipants.length > 0) {
            const decPrice = new Prisma.Decimal(lockedSession.price || 0);

            if (tx.sessionParticipant?.deleteMany) {
              await tx.sessionParticipant.deleteMany({
                where: {
                  id: { in: pendingParticipants.map(p => p.id) },
                },
              });
            }

            if (decPrice.gt(0) && walletService) {
              for (const p of pendingParticipants) {
                if (p.role === 'PLAYER') {
                  await walletService.refundFunds(p.userId, sessionIdInt, decPrice, tx);
                  currentHeldAmount = currentHeldAmount.minus(decPrice);
                }
              }
            }
          }
        }

        let updatedHeldAmount = currentHeldAmount;
        if (normalizedUpdateData.status === 'FINISHED' && lockedSession.status !== 'FINISHED') {
          updatedHeldAmount = new Prisma.Decimal(0);
        }

        const sessionUpdateResult = await tx.session.update({
          where: { id: sessionIdInt },
          data: {
            ...buildSessionUpdatePayload({
              normalizedUpdateData,
              shareTokenState,
            }),
            heldAmount: updatedHeldAmount,
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

        if (normalizedUpdateData.status === 'FINISHED' && lockedSession.status !== 'FINISHED') {
          const hoursToAdd = Math.round((session.duration || 180) / 60);
          
          const participantIds = session.participants
            .filter(p => p.status === 'CONFIRMED')
            .map(p => p.userId);
          
          const uniqueUserIds = [...new Set([...participantIds, session.ownerId])];

          for (const uid of uniqueUserIds) {
            await tx.userStats.upsert({
              where: { userId: uid },
              update: {
                hoursPlayed: { increment: hoursToAdd },
                sessionsPlayed: { increment: 1 },
              },
              create: {
                userId: uid,
                hoursPlayed: hoursToAdd,
                sessionsPlayed: 1,
              },
            });
          }

          const confirmedGm = tx.sessionParticipant?.findFirst
            ? await tx.sessionParticipant.findFirst({
                where: {
                  sessionId: sessionIdInt,
                  role: 'GM',
                  status: 'CONFIRMED',
                },
              })
            : null;

          if (confirmedGm && currentHeldAmount.gt(0) && walletService) {
            const feePercent = new Prisma.Decimal(lockedSession.platformFeePercent || 0);
            const payoutAmount = currentHeldAmount.mul(
              new Prisma.Decimal(1).minus(feePercent.div(100))
            );

            await walletService.payoutFunds(confirmedGm.userId, sessionIdInt, payoutAmount, tx);
          }
        }

        if (normalizedUpdateData.status === 'CANCELED') {
          await notifySessionCancelled({
            notificationService,
            session,
            requesterId,
            reason: options.reason,
            tx,
          });
        } else if (normalizedUpdateData.status !== 'FINISHED' && scheduleChanged) {
          await notifySessionRescheduled({
            notificationService,
            session,
            updatedSession: sessionUpdateResult,
            requesterId,
            tx,
          });

          await notifyConflictingParticipants({
            notificationService,
            session,
            updatedSession: sessionUpdateResult,
            conflictingParticipants,
            tx,
          });
        }

        return { sessionUpdateResult, shareTokenState };
      };

      const transactionResult = externalTx
        ? await executeUpdate(externalTx)
        : await prisma.$transaction(executeUpdate);

      const { sessionUpdateResult: updated, shareTokenState } = transactionResult;

      if (['FINISHED', 'CANCELED'].includes(normalizedUpdateData.status)) {
        vttStateManager.closeVtt(sessionId);
        try {
          callService.endCallIfActive(sessionId);
        } catch (err) {
          logger.error({ err, sessionId }, '[SessionLifecycle] Помилка автозакриття дзвінка при завершенні/скасуванні сесії');
        }
      }

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

      if (session.heldAmount && new Prisma.Decimal(session.heldAmount).gt(0)) {
        throw new AppError(ERROR_CODES.SESSION_DELETE_FORBIDDEN_HAS_FUNDS);
      }

      await prisma.session.delete({
        where: { id: sessionQueryService.parsePositiveInt(sessionId, 'Session ID') },
      });
    },

    async cancelSession(sessionId, userId, options = {}) {
      const { preloadedSession = null, bypassPermissions = false, tx: externalTx = null } = options;
      const session = await sessionQueryService.resolveSessionContext(sessionId, userId, preloadedSession);

      if (!bypassPermissions) {
        const isOwner = permissionHelpers._isSessionOwner(session, userId);
        const isCampaignOwner = permissionHelpers._isCampaignOwnerOverride(session, userId);
        const isConfirmedGm = permissionHelpers._canChangeSessionStatus(session, userId);

        let canCancel = false;
        if (session.status === 'PLANNED') {
          canCancel = isOwner || isCampaignOwner;
        } else if (session.status === 'ACTIVE') {
          canCancel = isConfirmedGm;
        }

        if (!canCancel) {
          const errorCode = session.status === 'ACTIVE'
            ? ERROR_CODES.SESSION_GM_ONLY
            : ERROR_CODES.SESSION_OWNER_ONLY;
          throw new AppError(errorCode);
        }
      }

      const sessionIdInt = sessionQueryService.parsePositiveInt(sessionId, 'Session ID');

      const runCancelTransaction = async (tx) => {
        const rows = await tx.$queryRaw`
          SELECT status, price, "heldAmount"
          FROM "Session"
          WHERE id = ${sessionIdInt}
          FOR UPDATE
        `;

        if (!rows || rows.length === 0) {
          throw new AppError(ERROR_CODES.SESSION_NOT_FOUND);
        }

        const lockedSession = rows[0];

        if (lockedSession.status === 'FINISHED') {
          throw new AppError(ERROR_CODES.SESSION_CANCEL_FINISHED_FORBIDDEN);
        }

        if (lockedSession.status === 'CANCELED') {
          throw new AppError(ERROR_CODES.SESSION_ALREADY_CANCELED);
        }

        const players = tx.sessionParticipant?.findMany
          ? await tx.sessionParticipant.findMany({
              where: {
                sessionId: sessionIdInt,
                role: 'PLAYER',
                status: { in: ['CONFIRMED', 'PENDING'] },
              },
            })
          : [];

        const decPrice = new Prisma.Decimal(lockedSession.price || 0);
        if (decPrice.gt(0) && walletService) {
          for (const player of players) {
            await walletService.refundFunds(player.userId, sessionIdInt, decPrice, tx);
          }
        }

        const updatedSession = await tx.session.update({
          where: { id: sessionIdInt },
          data: {
            status: 'CANCELED',
            heldAmount: 0,
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

        await notifySessionCancelled({
          notificationService,
          session: updatedSession,
          requesterId: userId,
          reason: options.reason,
          tx,
        });

        return updatedSession;
      };

      const updated = externalTx
        ? await runCancelTransaction(externalTx)
        : await prisma.$transaction(runCancelTransaction);

      vttStateManager.closeVtt(sessionId);
      try {
        callService.endCallIfActive(sessionId);
      } catch (err) {
        logger.error({ err, sessionId }, '[SessionLifecycle] Помилка автозакриття дзвінка при скасуванні сесії');
      }

      return { ...updated, startAt: updated.date };
    },

    async markSessionAsFinished(sessionId, userId, options = {}) {
      return this.updateSession(sessionId, userId, { status: 'FINISHED' }, options);
    },
  };
}

module.exports = createSessionLifecycleService;