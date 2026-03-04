const { prisma } = require('../lib/prisma');
const cron = require('node-cron');

class SessionCleanupService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  _getAutoCancelCutoff(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - daysOld);
    return cutoffDate;
  }

  async autoCancelStalePlannedSessions(daysOld = 30) {
    const timestamp = new Date().toISOString();

    try {
      const cutoffDate = this._getAutoCancelCutoff(daysOld);

      const result = await prisma.session.updateMany({
        where: {
          status: 'PLANNED',
          date: {
            lt: cutoffDate,
          },
        },
        data: {
          status: 'CANCELED',
        },
      });

      console.log(
        `[${timestamp}] Session Cleanup: Автоскасовано ${result.count} запланованих сесій старше ${daysOld} днів`
      );

      return {
        success: true,
        canceledCount: result.count,
        cutoffDate,
        timestamp,
      };
    } catch (error) {
      console.error(`[${timestamp}] Session Cleanup Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  async enqueueConfirmationReminders() {
    const timestamp = new Date().toISOString();

    try {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const sessionsNeedingConfirmation = await prisma.session.findMany({
        where: {
          status: 'PLANNED',
          date: {
            lt: now,
            gte: dayAgo,
          },
        },
        select: {
          id: true,
          creatorId: true,
          date: true,
          duration: true,
        },
      });

      if (sessionsNeedingConfirmation.length > 0) {
        console.log(
          `[${timestamp}] ℹ Reminder Hook: ${sessionsNeedingConfirmation.length} сесій потребують підтвердження статусу`
        );
      }

      // TODO: Інтегрувати notificationService для відправки нагадувань GM.

      return {
        success: true,
        remindersCount: sessionsNeedingConfirmation.length,
        timestamp,
      };
    } catch (error) {
      console.error(`[${timestamp}] Reminder Hook Error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  async performCleanup() {
    console.log('[Session Cleanup] Початок cleanup запланованих сесій...');

    const autoCancelResult = await this.autoCancelStalePlannedSessions(30);
    const reminderResult = await this.enqueueConfirmationReminders();

    return {
      autoCancel: autoCancelResult,
      reminders: reminderResult,
      completedAt: new Date().toISOString(),
    };
  }

  startCleanupJob(schedule = '0 3 * * *') {
    if (this.cronJob) {
      console.warn('Session Cleanup job вже запущено!');
      return;
    }

    this.cronJob = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        console.warn('Попередній Session Cleanup ще виконується, пропускаємо...');
        return;
      }

      this.isRunning = true;
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Помилка в session cleanup job:', error);
      } finally {
        this.isRunning = false;
      }
    });

    console.log(`Session Cleanup Job запущено з розкладом: "${schedule}"`);
    return this.cronJob;
  }

  stopCleanupJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Session Cleanup Job зупинено');
    }
  }

  async disconnect() {
    this.stopCleanupJob();
    console.log('Session Cleanup Service відключено');
  }
}

module.exports = new SessionCleanupService();
