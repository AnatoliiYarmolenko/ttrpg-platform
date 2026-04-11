const { prisma } = require('../lib/prisma');
const { redis, isRedisReady, recordRedisDegradation } = require('../lib/redis');
const { createError } = require('../constants/errors');
const { logger } = require('../lib/logger');

/**
 * Blacklist видалених акаунтів — тепер у Redis.
 *
 * Замість in-memory Set використовується Redis ключ з TTL = 900 секунд (15 хвилин).
 * Це відповідає терміну дії access JWT токена, що закриває вікно вразливості.
 *
 * При горизонтальному масштабуванні всі інстанси читають один Redis →
 * видалений акаунт заблокований на всіх подах одразу.
 */

const DELETED_USER_TTL_SECONDS = 15 * 60; // 900 сек = 15 хвилин (час життя access JWT)

/**
 * Додати userId до blacklist після анонімізації акаунту.
 * Ключ зникне автоматично через 15 хвилин (TTL).
 * @param {number} userId
 */
async function markUserAsDeleted(userId) {
  try {
    if (!isRedisReady()) {
      throw new Error('Redis is not ready');
    }

    await redis.set(`deleted:user:${userId}`, '1', 'EX', DELETED_USER_TTL_SECONDS);
  } catch (err) {
    recordRedisDegradation('deleted-users:mark', err);
    // Не кидаємо помилку — акаунт вже анонімізовано в БД.
    // blacklist через in-memory Set як fallback не потрібен:
    // при помилці Redis краще просто залогувати.
    logger.error({ err, userId }, '[DeletedUsers] Redis помилка markUserAsDeleted');
  }
}

/**
 * Перевірити, чи userId є в blacklist.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isUserDeleted(userId) {
  try {
    if (!isRedisReady()) {
      throw new Error('Redis is not ready');
    }

    const result = await redis.exists(`deleted:user:${userId}`);
    return result === 1;
  } catch (err) {
    recordRedisDegradation('deleted-users:check', err);
    logger.warn({ err, userId }, '[DeletedUsers] Redis недоступний, використовуємо DB fallback');

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isDeleted: true },
      });

      return Boolean(user?.isDeleted);
    } catch (dbErr) {
      logger.error({ err: dbErr, userId }, '[DeletedUsers] DB fallback failed');
      throw createError.serverUnavailable();
    }
  }
}

module.exports = { markUserAsDeleted, isUserDeleted };
