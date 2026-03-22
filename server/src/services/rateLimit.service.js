/**
 * Rate Limit Service (Redis-backed)
 *
 * Використовує Redis для зберігання лічильників запитів:
 *  - Лічильник: INCR + EXPIRE NX (атомарно через pipeline, Redis 7+)
 *  - Блокування: SET blocked:key 1 EX blockDurationSeconds (атомарно в один запит)
 *
 * При горизонтальному масштабуванні всі інстанси читають один Redis →
 * rate limit діє глобально, не обходиться балансуванням.
 */

const { redis } = require('../lib/redis');
const { createError } = require('../constants/errors');

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

  if (!config) {
    console.warn(`[Rate Limit] Невідомий тип операції: ${type}`);
    return true; // Якщо немає конфігурації — пропускаємо
  }

  const counterKey = getCounterKey(type, identifier);
  const blockedKey = getBlockedKey(type, identifier);
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  const blockSeconds = Math.ceil(config.blockDurationMs / 1000);

  try {
    // 1. Перевіряємо чи заблокований (один GET запит)
    const ttlRemaining = await redis.ttl(blockedKey);
    if (ttlRemaining > 0) {
      throw createError.rateLimitExceeded(ttlRemaining);
    }

    // 2. Атомарний підрахунок через pipeline:
    //    INCR — збільшуємо лічильник (або створюємо з 1)
    //    EXPIRE NX — встановлюємо TTL ТІЛЬКИ якщо його ще немає (перший запит у вікні)
    //    Це усуває race condition між INCR і EXPIRE
    const results = await redis.pipeline()
      .incr(counterKey)
      .expire(counterKey, windowSeconds, 'NX')
      .exec();

    // results[0] = [error, count], results[1] = [error, expireResult]
    const count = results[0][1];

    // 3. Перевіряємо чи перевищено ліміт
    if (count > config.maxRequests) {
      // Встановлюємо блокування (SET ... EX — атомарно в один запит)
      await redis.set(blockedKey, '1', 'EX', blockSeconds);
      throw createError.rateLimitExceeded(blockSeconds);
    }

    return true;
  } catch (err) {
    // Пробрасуємо лише AppError 429 далі
    if (err && err.status === 429) {
      throw err;
    }
    // При помилці Redis — fail-open (не блокуємо запит)
    console.error(`[Rate Limit] Redis помилка для ${type}:${identifier}:`, err.message);
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
    console.error(`[Rate Limit] Redis помилка resetRateLimit(${type}:${identifier}):`, err.message);
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
    return {
      count: parseInt(count[1], 10) || 0,
      isBlocked: blockedTtl[1] > 0,
      blockedSecondsRemaining: blockedTtl[1] > 0 ? blockedTtl[1] : 0,
    };
  } catch (err) {
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
  getRateLimitStatus,
  getRateLimitConfig,
  RATE_LIMIT_CONFIG,
};
