const { prisma } = require('../lib/prisma');
const cron = require('node-cron');
const { logger } = require('../lib/logger');

class SessionCleanupService {
  cronJob = null;
  isRunning = false;

  _getSessionAutoFinishAt(sessionDateValue, durationMinutes = 0) {
    const sessionStart = new Date(sessionDateValue);
    const safeDurationMinutes = Number.isFinite(Number(durationMinutes))
      ? Number(durationMinutes)
      : 0;

    // Auto-Finish:
    // +25 годин після планового завершення
    const totalGraceHours = 25;

    return new Date(
      sessionStart.getTime()
      + safeDurationMinutes * 60 * 1000
      + totalGraceHours * 60 * 60 * 1000
    );
  }

  _getAutoCancelCutoff(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysOld);
    return cutoffDate;
  }

  _getCanceledDeletionCutoff(daysOld = 7) {
    return this._getAutoCancelCutoff(daysOld);
  }

  async autoCancelStalePlannedSessions(daysOld = 3) {
    const timestamp = new Date().toISOString();

    try {
      const cutoffDate = this._getAutoCancelCutoff(daysOld);

      const sessionsToCancel = await prisma.session.findMany({
        where: {
          status: 'PLANNED',
          date: {
            lt: cutoffDate,
          },
        },
        include: {
          campaign: {
            select: {
              id: true,
              ownerId: true,
              status: true,
            },
          },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              status: true,
            },
          },
        },
      });

      if (sessionsToCancel.length === 0) {
        return {
          success: true,
          canceledCount: 0,
          cutoffDate,
          timestamp,
        };
      }

      const sessionService = require('./session.service');

      for (const session of sessionsToCancel) {
        await sessionService.lifecycleService.cancelSession(
          session.id,
          null,
          { preloadedSession: session, bypassPermissions: true, reason: 'stale_planned' }
        );
      }

      logger.info(
        { canceledCount: sessionsToCancel.length, daysOld, operation: 'autoCancelStalePlannedSessions' },
        'Session Cleanup: автоскасовано застарілі PLANNED сесії'
      );

      return {
        success: true,
        canceledCount: sessionsToCancel.length,
        cutoffDate,
        timestamp,
      };
    } catch (error) {
      logger.error({ err: error, daysOld, operation: 'autoCancelStalePlannedSessions' }, 'Session Cleanup Error');
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  async autoCancelSessionsWithoutGm() {
    const timestamp = new Date().toISOString();

    try {
      const now = new Date();

      const sessionsWithoutGm = await prisma.session.findMany({
        where: {
          status: 'PLANNED',
          date: { lt: now },
        },
        include: {
          campaign: {
            select: {
              id: true,
              ownerId: true,
              status: true,
            },
          },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              status: true,
            },
          },
        },
      });

      const sessionsToCancel = sessionsWithoutGm.filter(
        (session) => !session.participants.some((p) => p.role === 'GM' && p.status === 'CONFIRMED')
      );

      if (sessionsToCancel.length === 0) {
        return {
          success: true,
          canceledCount: 0,
          scannedCount: sessionsWithoutGm.length,
          timestamp,
        };
      }

      const sessionService = require('./session.service');

      for (const session of sessionsToCancel) {
        await sessionService.lifecycleService.cancelSession(
          session.id,
          null,
          { preloadedSession: session, bypassPermissions: true, reason: 'no_gm' }
        );
      }

      logger.info(
        { canceledCount: sessionsToCancel.length, scannedCount: sessionsWithoutGm.length, operation: 'autoCancelSessionsWithoutGm' },
        'Session Cleanup: автоскасовано PLANNED сесії без CONFIRMED GM'
      );

      return {
        success: true,
        canceledCount: sessionsToCancel.length,
        scannedCount: sessionsWithoutGm.length,
        timestamp,
      };
    } catch (error) {
      logger.error({ err: error, operation: 'autoCancelSessionsWithoutGm' }, 'Session Cleanup Without GM Error');
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  async autoFinishStaleActiveSessions() {
    const timestamp = new Date().toISOString();

    try {
      const now = new Date();
      const activeSessions = await prisma.session.findMany({
        where: {
          status: 'ACTIVE',
        },
        include: {
          campaign: {
            select: {
              id: true,
              ownerId: true,
              status: true,
            },
          },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              status: true,
            },
          },
        },
      });

      const staleActiveSessions = activeSessions.filter((session) =>
        now >= this._getSessionAutoFinishAt(session.date, session.duration)
      );

      if (staleActiveSessions.length === 0) {
        return {
          success: true,
          finishedCount: 0,
          scannedCount: activeSessions.length,
          timestamp,
        };
      }

      const sessionService = require('./session.service');

      for (const session of staleActiveSessions) {
        await sessionService.lifecycleService.updateSession(
          session.id,
          null,
          { status: 'FINISHED' },
          { preloadedSession: session, bypassPermissions: true }
        );
      }

      logger.info(
        { finishedCount: staleActiveSessions.length, scannedCount: activeSessions.length, operation: 'autoFinishStaleActiveSessions' },
        'Session Cleanup: автозавершено ACTIVE сесії (soft auto-finish)'
      );

      return {
        success: true,
        finishedCount: staleActiveSessions.length,
        scannedCount: activeSessions.length,
        timestamp,
      };
    } catch (error) {
      logger.error({ err: error, operation: 'autoFinishStaleActiveSessions' }, 'Session Auto-Finish Error');
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  async autoDeleteCanceledSessions(daysOld = 7) {
    const timestamp = new Date().toISOString();

    try {
      const cutoffDate = this._getCanceledDeletionCutoff(daysOld);

      const canceledSessions = await prisma.session.findMany({
        where: {
          status: 'CANCELED',
          updatedAt: {
            lt: cutoffDate,
          },
        },
        select: { id: true },
      });

      if (canceledSessions.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          scannedCount: 0,
          cutoffDate,
          timestamp,
        };
      }

      const canceledSessionIds = canceledSessions.map((session) => session.id);

      const deleteResult = await prisma.session.deleteMany({
        where: { id: { in: canceledSessionIds } },
      });

      logger.info(
        { deletedCount: deleteResult.count, scannedCount: canceledSessions.length, daysOld, operation: 'autoDeleteCanceledSessions' },
        'Session Cleanup: видалено застарілі CANCELED сесії'
      );

      return {
        success: true,
        deletedCount: deleteResult.count,
        scannedCount: canceledSessions.length,
        cutoffDate,
        timestamp,
      };
    } catch (error) {
      logger.error({ err: error, daysOld, operation: 'autoDeleteCanceledSessions' }, 'Session Cleanup Delete CANCELED Error');
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  async sendPendingActiveSessionWarnings() {
    const timestamp = new Date().toISOString();
    try {
      const now = new Date();
      
      const activeSessions = await prisma.session.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          date: true,
          duration: true,
          ownerId: true,
        },
      });

      if (activeSessions.length === 0) {
        return { success: true, warnedCount: 0, timestamp };
      }

      const notificationService = require('./notification.service');
      let warnedCount = 0;

      for (const session of activeSessions) {
        const plannedEnd = new Date(new Date(session.date).getTime() + (session.duration || 180) * 60 * 1000);
        const diffMs = now.getTime() - plannedEnd.getTime();
        const diffHours = diffMs / (60 * 60 * 1000);

        const sessionTitle = session.title || 'Нова сесія';

        if (diffHours >= 3 && diffHours < 12) {
          await notificationService.createNotification({
            eventKey: `session_stale_warning_3h:${session.id}`,
            type: 'SESSION_STALE_WARNING',
            severity: 'INFO',
            category: 'session',
            title: 'Завершіть сесію',
            body: `Ваша сесія "${sessionTitle}" закінчилися більше 3 годин тому. Будь ласка, переведіть її в статус "Завершена" в налаштуваннях.`,
            link: `/session/${session.id}`,
            recipientIds: [session.ownerId],
            dedupeKey: `session:${session.id}:stale_warning:3h`,
            dedupeWindowMs: 48 * 60 * 60 * 1000,
          });
          warnedCount++;
        }

        if (diffHours >= 12 && diffHours < 24) {
          await notificationService.createNotification({
            eventKey: `session_stale_warning_12h:${session.id}`,
            type: 'SESSION_STALE_WARNING',
            severity: 'WARNING',
            category: 'session',
            title: 'Нагадування: завершіть сесію',
            body: `Ваша сесія "${sessionTitle}" закінчилися більше 12 годин тому. Не забудьте перевести її в статус "Завершена".`,
            link: `/session/${session.id}`,
            recipientIds: [session.ownerId],
            dedupeKey: `session:${session.id}:stale_warning:12h`,
            dedupeWindowMs: 48 * 60 * 60 * 1000,
          });
          warnedCount++;
        }

        if (diffHours >= 24) {
          await notificationService.createNotification({
            eventKey: `session_stale_warning_24h:${session.id}`,
            type: 'SESSION_STALE_WARNING',
            severity: 'ERROR',
            category: 'session',
            title: 'Увага: сесія буде автоматично завершена',
            body: `Ваша сесія "${sessionTitle}" закінчилися більше 24 годин тому. Сесія буде автоматично переведена в статус "Завершена" найближчим часом.`,
            link: `/session/${session.id}`,
            recipientIds: [session.ownerId],
            dedupeKey: `session:${session.id}:stale_warning:24h`,
            dedupeWindowMs: 48 * 60 * 60 * 1000,
          });
          warnedCount++;
        }
      }

      return { success: true, warnedCount, timestamp };
    } catch (error) {
      logger.error({ err: error, operation: 'sendPendingActiveSessionWarnings' }, 'Session Stale Warning Error');
      return { success: false, error: error.message, timestamp };
    }
  }

  _formatTime(dateVal) {
    const d = new Date(dateVal);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  async sendUpcomingSessionReminders() {
    const timestamp = new Date().toISOString();
    try {
      const now = new Date();
      const next25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const sessions = await prisma.session.findMany({
        where: {
          status: 'PLANNED',
          date: {
            gte: now,
            lte: next25Hours,
          },
        },
        include: {
          participants: {
            where: {
              status: 'CONFIRMED',
            },
            select: {
              userId: true,
            },
          },
        },
      });

      if (sessions.length === 0) {
        return { success: true, remindersSent: 0, timestamp };
      }

      const notificationService = require('./notification.service');
      let remindersSent = 0;

      for (const session of sessions) {
        const diffMs = new Date(session.date).getTime() - now.getTime();
        const diffHours = diffMs / (60 * 60 * 1000);

        const recipientIds = session.participants.map((p) => p.userId);
        if (recipientIds.length === 0) {
          continue;
        }

        const sessionTitle = session.title || 'Нова сесія';
        const timeStr = this._formatTime(session.date);

        // 24 години до старту (23.5 - 24.5 год)
        if (diffHours >= 23.5 && diffHours < 24.5) {
          await notificationService.createNotification({
            eventKey: `session_upcoming_24h:${session.id}`,
            type: 'SESSION_REMINDER',
            severity: 'INFO',
            category: 'session',
            title: 'Гра почнеться за 24 години',
            body: `Нагадування: ваша сесія "${sessionTitle}" запланована на завтра о ${timeStr}.`,
            link: `/session/${session.id}`,
            recipientIds,
            dedupeKey: `session:${session.id}:reminder:24h`,
            dedupeWindowMs: 48 * 60 * 60 * 1000,
          });
          remindersSent += recipientIds.length;
        }

        // 1 година до старту (0.75 - 1.75 год)
        if (diffHours >= 0.75 && diffHours < 1.75) {
          await notificationService.createNotification({
            eventKey: `session_upcoming_1h:${session.id}`,
            type: 'SESSION_REMINDER',
            severity: 'INFO',
            category: 'session',
            title: 'Гра почнеться за 1 годину',
            body: `Нагадування: ваша сесія "${sessionTitle}" почнеться за 1 годину (о ${timeStr}).`,
            link: `/session/${session.id}`,
            recipientIds,
            dedupeKey: `session:${session.id}:reminder:1h`,
            dedupeWindowMs: 48 * 60 * 60 * 1000,
          });
          remindersSent += recipientIds.length;
        }
      }

      return { success: true, remindersSent, timestamp };
    } catch (error) {
      logger.error({ err: error, operation: 'sendUpcomingSessionReminders' }, 'Upcoming Session Reminders Error');
      return { success: false, error: error.message, timestamp };
    }
  }

  async autoHandleForgottenSessions() {
    const timestamp = new Date().toISOString();
    try {
      const now = new Date();

      const forgottenSessions = await prisma.session.findMany({
        where: {
          status: 'PLANNED',
          date: {
            lt: now,
          },
        },
        include: {
          campaign: {
            select: {
              id: true,
              ownerId: true,
              status: true,
            },
          },
          participants: {
            select: {
              id: true,
              userId: true,
              role: true,
              status: true,
            },
          },
        },
      });

      if (forgottenSessions.length === 0) {
        return { success: true, warnedCount: 0, canceledCount: 0, timestamp };
      }

      // Фільтруємо лише сесії, які МАЮТЬ підтвердженого GM
      // (сесії БЕЗ підтвердженого GM обробляються окремо в autoCancelSessionsWithoutGm)
      const sessionsWithGm = forgottenSessions.filter((session) =>
        session.participants.some((p) => p.role === 'GM' && p.status === 'CONFIRMED')
      );

      if (sessionsWithGm.length === 0) {
        return { success: true, warnedCount: 0, canceledCount: 0, timestamp };
      }

      const notificationService = require('./notification.service');
      const sessionService = require('./session.service');

      let warnedCount = 0;
      let canceledCount = 0;

      for (const session of sessionsWithGm) {
        const diffMs = now.getTime() - new Date(session.date).getTime();
        const diffHours = diffMs / (60 * 60 * 1000);

        const gmParticipant = session.participants.find((p) => p.role === 'GM' && p.status === 'CONFIRMED');
        const gmUserId = gmParticipant ? gmParticipant.userId : null;

        const sessionTitle = session.title || 'Нова сесія';
        const timeStr = this._formatTime(session.date);

        // Попередження: від 30 хвилин до 24 годин
        if (diffHours >= 0.5 && diffHours < 24) {
          if (gmUserId) {
            await notificationService.createNotification({
              eventKey: `session_forgotten_warning:${session.id}`,
              type: 'SESSION_START_WARNING',
              severity: 'WARNING',
              category: 'session',
              title: 'Ви забули розпочати гру',
              body: `Ваша запланована сесія "${sessionTitle}" мала розпочатися о ${timeStr}. Будь ласка, розпочніть її. Якщо ви не розпочнете гру протягом 24 годин з планового часу початку, вона буде автоматично скасована.`,
              link: `/session/${session.id}`,
              recipientIds: [gmUserId],
              dedupeKey: `session:${session.id}:forgotten_warning`,
              dedupeWindowMs: 48 * 60 * 60 * 1000,
            });
            warnedCount++;
          }
        }

        // Автоскасування: більше 24 годин
        if (diffHours >= 24) {
          await sessionService.lifecycleService.cancelSession(
            session.id,
            null,
            { preloadedSession: session, bypassPermissions: true, reason: 'gm_forgot' }
          );
          canceledCount++;
        }
      }

      return { success: true, warnedCount, canceledCount, timestamp };
    } catch (error) {
      logger.error({ err: error, operation: 'autoHandleForgottenSessions' }, 'Forgotten Sessions Handler Error');
      return { success: false, error: error.message, timestamp };
    }
  }

  async performCleanup() {
    logger.info('[Session Cleanup] Початок cleanup запланованих сесій');

    const upcomingRemindersResult = await this.sendUpcomingSessionReminders();
    const forgottenSessionsResult = await this.autoHandleForgottenSessions();
    const staleWarningsResult = await this.sendPendingActiveSessionWarnings();
    const autoCancelWithoutGmResult = await this.autoCancelSessionsWithoutGm();
    const autoCancelResult = await this.autoCancelStalePlannedSessions(3);
    const autoFinishResult = await this.autoFinishStaleActiveSessions();
    const autoDeleteCanceledResult = await this.autoDeleteCanceledSessions(7);

    return {
      upcomingReminders: upcomingRemindersResult,
      forgottenSessions: forgottenSessionsResult,
      staleWarnings: staleWarningsResult,
      autoCancelWithoutGm: autoCancelWithoutGmResult,
      autoCancel: autoCancelResult,
      autoFinish: autoFinishResult,
      autoDeleteCanceled: autoDeleteCanceledResult,
      completedAt: new Date().toISOString(),
    };
  }

  startCleanupJob(schedule = '*/15 * * * *') {
    if (this.cronJob) {
      logger.warn('Session Cleanup job вже запущено');
      return;
    }

    this.cronJob = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.warn('Попередній Session Cleanup ще виконується, пропускаємо');
        return;
      }

      this.isRunning = true;
      try {
        await this.performCleanup();
      } catch (error) {
        logger.error({ err: error }, 'Помилка в session cleanup job');
      } finally {
        this.isRunning = false;
      }
    });

    logger.info({ schedule }, 'Session Cleanup Job запущено');
    return this.cronJob;
  }

  stopCleanupJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Session Cleanup Job зупинено');
    }
  }

  async disconnect() {
    this.stopCleanupJob();
    logger.info('Session Cleanup Service відключено');
  }
}

module.exports = new SessionCleanupService();