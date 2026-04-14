/**
 * Модуль для ініціалізації cleanup jobs
 * - Очистка прострочених токенів
 * Note: Rate limit cleanup більше не потрібна — Redis TTL автоматично видаляє застарілі записи
 */

const tokenCleanupService = require('../services/token-cleanup.service');
const sessionCleanupService = require('../services/session-cleanup.service');
const { logger } = require('../lib/logger');

// Інтервали для cleanup jobs
const INITIAL_TOKEN_CLEANUP_DELAY = 30000; // 30 секунд

let initialCleanupTimeout = null;

/**
 * Ініціалізує token cleanup job
 * Запускає cron job для очистки прострочених токенів
 * @param {string} schedule - Cron schedule (за замовчуванням: '0 2 * * *' - 02:00 щодня)
 */
function initTokenCleanup(schedule) {
  const cleanupSchedule = schedule || process.env.TOKEN_CLEANUP_SCHEDULE || '0 2 * * *';
  tokenCleanupService.startCleanupJob(cleanupSchedule);

  // Виконуємо першу очистку при старті сервера (з затримкою)
  initialCleanupTimeout = setTimeout(async () => {
    logger.info('Startup: Виконуємо першу очистку токенів при старті');
    await tokenCleanupService.performFullCleanup();
  }, INITIAL_TOKEN_CLEANUP_DELAY);
}

/**
 * Ініціалізує session cleanup job
 * - Автоскасовує PLANNED сесії старше 30 днів
 * - Soft Auto-Finish для "зомбі" ACTIVE сесій
 * - Автовидаляє CANCELED сесії через 7 днів
 * @param {string} schedule - Cron schedule (за замовчуванням: '0,15,30,45 * * * *' - кожні 15 хвилин)
 */
function initSessionCleanup(schedule) {
  const cleanupSchedule = schedule || process.env.SESSION_CLEANUP_SCHEDULE || '*/15 * * * *';
  sessionCleanupService.startCleanupJob(cleanupSchedule);
}

/**
 * Ініціалізує всі cleanup jobs
 * @param {Object} options - Опції для cleanup jobs
 */
function initAllCleanupJobs(options = {}) {
  initTokenCleanup(options.tokenCleanupSchedule);
  initSessionCleanup(options.sessionCleanupSchedule);
}

/**
 * Зупиняє всі cleanup jobs
 */
function stopAllCleanupJobs() {
  if (initialCleanupTimeout) {
    clearTimeout(initialCleanupTimeout);
    initialCleanupTimeout = null;
  }
}

/**
 * Graceful shutdown для cleanup jobs
 */
async function shutdownCleanupJobs() {
  stopAllCleanupJobs();
  await tokenCleanupService.disconnect();
  await sessionCleanupService.disconnect();
}

module.exports = {
  initTokenCleanup,
  initSessionCleanup,
  initAllCleanupJobs,
  stopAllCleanupJobs,
  shutdownCleanupJobs,
};
