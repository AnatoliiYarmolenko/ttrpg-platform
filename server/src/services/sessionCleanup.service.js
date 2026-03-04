const { prisma } = require('../lib/prisma');
const cron = require('node-cron');

class SessionCleanupService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  _getSessionAutoFinishAt(sessionDateValue, durationMinutes = 0) {
    const sessionStart = new Date(sessionDateValue);
    const safeDurationMinutes = Number.isFinite(Number(durationMinutes))
      ? Number(durationMinutes)
      : 0;

    // Soft Auto-Finish:
    // +2 години після планового завершення (вікно очікування),
    // +1 година до автозавершення (вікно для майбутнього попередження)
    const totalGraceHours = 3;

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

  async autoFinishStaleActiveSessions() {
    const timestamp = new Date().toISOString();

    try {
      const now = new Date();
      const activeSessions = await prisma.session.findMany({
        where: {
          status: 'ACTIVE',
        },
        select: {
          id: true,
          date: true,
          duration: true,
        },
      });

      const staleActiveIds = activeSessions
        .filter((session) => now >= this._getSessionAutoFinishAt(session.date, session.duration))
        .map((session) => session.id);

      if (staleActiveIds.length === 0) {
        return {
          success: true,
          finishedCount: 0,
          scannedCount: activeSessions.length,
          timestamp,
        };
      }

      const updateResult = await prisma.session.updateMany({
        where: {
          id: { in: staleActiveIds },
          status: 'ACTIVE',
        },
        data: {
          status: 'FINISHED',
        },
      });

      console.log(
        `[${timestamp}] Session Cleanup: Автозавершено ${updateResult.count} ACTIVE сесій (soft auto-finish)`
      );

      return {
        success: true,
        finishedCount: updateResult.count,
        scannedCount: activeSessions.length,
        timestamp,
      };
    } catch (error) {
      console.error(`[${timestamp}] Session Auto-Finish Error: ${error.message}`);
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
    const autoFinishResult = await this.autoFinishStaleActiveSessions();

    return {
      autoCancel: autoCancelResult,
      autoFinish: autoFinishResult,
      completedAt: new Date().toISOString(),
    };
  }

  startCleanupJob(schedule = '*/15 * * * *') {
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
