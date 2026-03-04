/**
 * Модуль для ініціалізації cleanup jobs
 * - Очистка прострочених токенів
 * - Очистка rate limit записів
 */

const tokenCleanupService = require('../services/tokenCleanup.service');
const sessionCleanupService = require('../services/sessionCleanup.service');
const { cleanupRateLimits } = require('../services/rateLimit.service');

// Інтервали для cleanup jobs
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 хвилин
const INITIAL_TOKEN_CLEANUP_DELAY = 30000; // 30 секунд

let rateLimitCleanupInterval = null;
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
    console.log('[Startup] 🧹 Виконуємо першу очистку токенів при старті...');
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
 * Ініціалізує rate limit cleanup job
 * Очищує застарілі rate limit записи
 */
function initRateLimitCleanup() {
  rateLimitCleanupInterval = setInterval(() => {
    cleanupRateLimits();
  }, RATE_LIMIT_CLEANUP_INTERVAL);

  console.log('✅ Rate Limit Cleanup запущено (кожні 5 хвилин)');
}

/**
 * Ініціалізує всі cleanup jobs
 * @param {Object} options - Опції для cleanup jobs
 * @param {string} options.tokenCleanupSchedule - Cron schedule для token cleanup
 */
function initAllCleanupJobs(options = {}) {
  initTokenCleanup(options.tokenCleanupSchedule);
  initSessionCleanup(options.sessionCleanupSchedule);
  initRateLimitCleanup();
}

/**
 * Зупиняє всі cleanup jobs
 */
function stopAllCleanupJobs() {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
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
  initRateLimitCleanup,
  initAllCleanupJobs,
  stopAllCleanupJobs,
  shutdownCleanupJobs,
};
