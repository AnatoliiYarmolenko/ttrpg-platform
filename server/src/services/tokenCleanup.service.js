const { prisma } = require('../lib/prisma');
const cron = require('node-cron');
const { logger } = require('../lib/logger');

class TokenCleanupService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Видаляє прострочені refresh токени з БД
   * @returns {Object} Результат операції з кількістю видалених токенів
   */
  async cleanupExpiredTokens() {
    try {
      const now = new Date();
      
      // Видаляємо токени, які прострочилися
      const result = await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: now, // less than (раніше ніж зараз)
          },
        },
      });

      const deletedCount = result.count;
      const timestamp = new Date().toISOString();

      logger.info(
        { deletedCount, operation: 'cleanupExpiredTokens' },
        'Token Cleanup: refresh токени видалено'
      );

      return {
        success: true,
        deletedCount,
        timestamp,
        message: `Видалено ${deletedCount} прострочених токенів`,
      };
    } catch (error) {
      const timestamp = new Date().toISOString();
      logger.error({ err: error, operation: 'cleanupExpiredTokens' }, 'Token Cleanup Error');

      return {
        success: false,
        error: error.message,
        timestamp,
      };
    }
  }

  /**
   * Видаляє відкликані (revoked) токени як страховка.
   * З поточною логікою токени видаляються одразу при logout/refresh,
   * тому ця функція збирає лише залишки (напр. після збоїв).
   * @returns {Object} Результат операції
   */
  async cleanupRevokedTokens(daysOld = 1) {
    const timestamp = new Date().toISOString();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.refreshToken.deleteMany({
        where: {
          AND: [
            { revoked: true },
            { createdAt: { lt: cutoffDate } },
          ],
        },
      });

      const deletedCount = result.count;

      logger.info(
        { deletedCount, daysOld, operation: 'cleanupRevokedTokens' },
        'Token Cleanup: revoked токени видалено'
      );

      return {
        success: true,
        deletedCount,
        timestamp,
      };
    } catch (error) {
      logger.error({ err: error, daysOld, operation: 'cleanupRevokedTokens' }, 'Revoked Token Cleanup Error');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Повна очистка (прострочені + старі відкликані)
   */
  async performFullCleanup() {
    logger.info('Token Cleanup: Початок повної очистки токенів');
    
    const expiredResult = await this.cleanupExpiredTokens();
    const revokedResult = await this.cleanupRevokedTokens();

    return {
      expired: expiredResult,
      revoked: revokedResult,
      completedAt: new Date().toISOString(),
    };
  }

  /**
   * Запускає cron job для автоматичної очистки
   * @param {string} schedule - Cron розклад (за замовченням щодня о 2:00 AM)
   * 
   * Приклади розкладу:
   * "0 2 * * *" - 02:00 кожного дня
   * "0 asterisk/6 * * *" - кожні 6 годин
   * "0 0 * * 0" - щонеділі о 00:00
   * "asterisk/15 * * * *" - кожні 15 хвилин
   */
  startCleanupJob(schedule = '0 2 * * *') {
    if (this.cronJob) {
      logger.warn('Cleanup job вже запущено');
      return;
    }

    this.cronJob = cron.schedule(schedule, async () => {
      if (this.isRunning) {
        logger.warn('Попередня очистка ще виконується, пропускаємо');
        return;
      }

      this.isRunning = true;
      try {
        await this.performFullCleanup();
      } catch (error) {
        logger.error({ err: error }, 'Token Cleanup: Помилка в cleanup job');
      } finally {
        this.isRunning = false;
      }
    });

    logger.info({ schedule }, 'Token Cleanup Job запущено');
    return this.cronJob;
  }

  /**
   * Зупиняє cron job
   */
  stopCleanupJob() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Token Cleanup Job зупинено');
    }
  }

  /**
   * Отримує статистику по токенах
   */
  async getTokenStats() {
    try {
      const now = new Date();

      const [totalTokens, expiredTokens, revokedTokens, activeTokens] = await Promise.all([
        prisma.refreshToken.count(),
        prisma.refreshToken.count({
          where: { expiresAt: { lt: now } },
        }),
        prisma.refreshToken.count({
          where: { revoked: true },
        }),
        prisma.refreshToken.count({
          where: {
            AND: [
              { revoked: false },
              { expiresAt: { gte: now } },
            ],
          },
        }),
      ]);

      return {
        totalTokens,
        expiredTokens,
        revokedTokens,
        activeTokens,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error({ err: error }, 'Помилка отримання статистики токенів');
      return { error: error.message };
    }
  }

  /**
   * Закриває з'єднання з БД
   */
  async disconnect() {
    this.stopCleanupJob();
    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
    logger.info('Token Cleanup Service відключено');
  }
}

// Експортуємо singleton
module.exports = new TokenCleanupService();
