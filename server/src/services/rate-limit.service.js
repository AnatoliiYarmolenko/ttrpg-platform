const { redis, isRedisReady, recordRedisDegradation } = require('../lib/redis');
const { createError } = require('../constants/errors');
const { logger } = require('../lib/logger');

// Конфігурація rate limit для різних типів операцій
const RATE_LIMIT_CONFIG = {
  refresh: {
    maxRequests: 5,                  // Макс 5 refresh запитів
    windowMs: 60 * 1000,             // За 60 секунд (1 хвилина)
    blockDurationMs: 5 * 60 * 1000, // Блокування на 5 хвилин після перевищення
  },
  login: {
    maxRequests: 5,                   // Макс 5 спроб входу
    windowMs: 15 * 60 * 1000,         // За 15 хвилин
    blockDurationMs: 30 * 60 * 1000, // Блокування на 30 хвилин
  },
  passwordReset: {
    maxRequests: 3,                   // Макс 3 запити на скидання пароля
    windowMs: 60 * 60 * 1000,         // За 1 годину
    blockDurationMs: 60 * 60 * 1000, // Блокування на 1 годину
  },
};

const SECURITY_CRITICAL_TYPES = new Set([
  'refresh',
  'login',
  'passwordReset',
  'auth_login',
  'auth_register',
  'auth_forgot_password',
  'auth_resend_verification',
  'auth_verify_email',
  'security_change_password',
  'security_email_change',
  'security_confirm_email_change',
  'security_delete_account',
]);

function shouldFailClosed(type, config = null) {
  if (SECURITY_CRITICAL_TYPES.has(type)) {
    return true;
  }

  if (config?.failClosed === true) {
    return true;
  }

  if (config?.failOpen === true) {
    return false;
  }

  return false;
}

/**
 * Генерує ключ для лічильника запитів
 */
function getCounterKey(type, identifier) {
  return `rateLimit:counter:${type}:${identifier}`;
}

/**
 * Генерує ключ для блокування
 */
function getBlockedKey(type, identifier) {
  return `rateLimit:blocked:${type}:${identifier}`;
}

/**
 * Перевіряє rate limit для конкретної операції.
 *
 * Алгоритм:
 * 1. Перевіряємо ключ blocked — якщо є, кидаємо 429
 * 2. Атомарно INCR лічильник + EXPIRE NX (лише якщо TTL ще немає)
 *    Це запобігає race condition між INCR і EXPIRE
 * 3. Якщо лічильник > maxRequests — встановлюємо blocked ключ з TTL і кидаємо 429
 *
 * @param {string} type - Тип операції ('refresh', 'login', 'passwordReset')
 * @param {string|number} identifier - Ідентифікатор (userId, email, IP)
 * @param {Object|null} customConfig - Кастомна конфігурація (опційно)
 * @returns {Promise<boolean>} true якщо операція дозволена
 * @throws {AppError} якщо перевищено ліміт (status: 429)
 */
async function checkRateLimit(type, identifier, customConfig = null) {
  const config = customConfig || RATE_LIMIT_CONFIG[type];
  const failClosed = shouldFailClosed(type, config);

  if (!config) {
    logger.warn({ type }, '[Rate Limit] Невідомий тип операції');
    return true; // Якщо немає конфігурації — пропускаємо
  }

  const counterKey = getCounterKey(type, identifier);
  const blockedKey = getBlockedKey(type, identifier);
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const blockSeconds = Math.ceil(config.blockDurationMs / 1000);

  if (!isRedisReady()) {
    const err = new Error('Redis is not ready');
    recordRedisDegradation('rate-limit', err);
    logger.error({ type, identifier, failClosed }, '[Rate Limit] Redis недоступний до виконання ліміту');

    if (failClosed) {
      throw createError.rateLimitUnavailable();
    }

    return true;
  }

  try {
    const ttlRemaining = await redis.ttl(blockedKey);
    if (ttlRemaining > 0) {
      throw createError.rateLimitExceeded(ttlRemaining);
    }

    const results = await redis.pipeline()
      .incr(counterKey)
      .expire(counterKey, windowSeconds, 'NX')
      .exec();

    const count = results[0][1];

    if (count > config.maxRequests) {
      await redis.set(blockedKey, '1', 'EX', blockSeconds);
      throw createError.rateLimitExceeded(blockSeconds);
    }

    return true;
  } catch (err) {
    if (err?.status === 429) {
      throw err;
    }
    recordRedisDegradation('rate-limit', err);
    logger.error({ err, type, identifier, failClosed }, '[Rate Limit] Redis помилка');

    if (failClosed) {
      throw createError.rateLimitUnavailable();
    }

    return true;
  }
}

/**
 * Перевіряє rate limit для refresh токенів (alias для зворотної сумісності)
 * @param {number} userId - ID користувача
 * @returns {Promise<boolean>}
 */
async function checkRefreshRateLimit(userId) {
  return checkRateLimit('refresh', userId);
}

/**
 * Скидає rate limit для користувача (наприклад, після успішного входу)
 * @param {string} type - Тип операції
 * @param {string|number} identifier - Ідентифікатор
 */
async function resetRateLimit(type, identifier) {
  try {
    await redis.pipeline()
      .del(getCounterKey(type, identifier))
      .del(getBlockedKey(type, identifier))
      .exec();
  } catch (err) {
    logger.error({ err, type, identifier }, '[Rate Limit] Redis помилка resetRateLimit');
  }
}

/**
 * Декрементує лічильник rate limit (використовується для skipSuccessfulRequests)
 * @param {string} type - Тип операції
 * @param {string|number} identifier - Ідентифікатор
 */
async function decrementRateLimit(type, identifier) {
  try {
    const counterKey = getCounterKey(type, identifier);
    const nextCount = await redis.decr(counterKey);

    if (nextCount <= 0) {
      await redis.del(counterKey);
    }
  } catch (err) {
    logger.error({ err, type, identifier }, '[Rate Limit] Redis помилка decrementRateLimit');
  }
}

/**
 * Отримує поточний стан rate limit для конкретного ідентифікатора
 * @param {string} type - Тип операції
 * @param {string|number} identifier - Ідентифікатор
 * @returns {Promise<Object>} Стан rate limit
 */
async function getRateLimitStatus(type, identifier) {
  try {
    const [count, blockedTtl] = await redis.pipeline()
      .get(getCounterKey(type, identifier))
      .ttl(getBlockedKey(type, identifier))
      .exec();
    const blockedSecondsRemaining = Math.max(blockedTtl[1], 0);

    return {
      count: Number.parseInt(count[1], 10) || 0,
      isBlocked: blockedSecondsRemaining > 0,
      blockedSecondsRemaining,
    };
  } catch (err) {
    recordRedisDegradation('rate-limit:status', err);
    logger.error({ err, type, identifier }, '[Rate Limit] Redis помилка getRateLimitStatus');
    return { count: 0, isBlocked: false, blockedSecondsRemaining: 0 };
  }
}

/**
 * Отримує конфігурацію rate limit
 * @returns {Object} Конфігурація
 */
function getRateLimitConfig() {
  return { ...RATE_LIMIT_CONFIG };
}

module.exports = {
  checkRateLimit,
  checkRefreshRateLimit,
  resetRateLimit,
  decrementRateLimit,
  getRateLimitStatus,
  getRateLimitConfig,
  RATE_LIMIT_CONFIG,
};
