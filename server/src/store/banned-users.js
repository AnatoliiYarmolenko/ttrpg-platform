const { prisma } = require('../lib/prisma');
const { redis, isRedisReady, recordRedisDegradation } = require('../lib/redis');
const { createError } = require('../constants/errors');
const { logger } = require('../lib/logger');

const BANNED_USER_TTL_SECONDS = 15 * 60; // 900 сек = 15 хвилин (час життя access JWT)

/**
 * Додати userId до blacklist після бана акаунту.
 * Ключ зникне автоматично через 15 хвилин (TTL).
 * @param {number} userId
 */
async function markUserAsBanned(userId) {
  try {
    if (!isRedisReady()) {
      throw new Error('Redis is not ready');
    }

    await redis.set(`banned:user:${userId}`, '1', 'EX', BANNED_USER_TTL_SECONDS);
  } catch (err) {
    recordRedisDegradation('banned-users:mark', err);
    logger.error({ err, userId }, '[BannedUsers] Redis помилка markUserAsBanned');
    throw createError.serverUnavailable();
  }
}

/**
 * Видалити userId з blacklist після розбану.
 * @param {number} userId
 */
async function unmarkUserAsBanned(userId) {
  try {
    if (!isRedisReady()) {
      throw new Error('Redis is not ready');
    }

    await redis.del(`banned:user:${userId}`);
  } catch (err) {
    recordRedisDegradation('banned-users:unmark', err);
    logger.error({ err, userId }, '[BannedUsers] Redis помилка unmarkUserAsBanned');
    throw createError.serverUnavailable();
  }
}

/**
 * Перевірити, чи userId є в blacklist забанених.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isUserBanned(userId) {
  try {
    if (!isRedisReady()) {
      throw new Error('Redis is not ready');
    }

    const result = await redis.exists(`banned:user:${userId}`);
    return result === 1;
  } catch (err) {
    recordRedisDegradation('banned-users:check', err);
    logger.warn({ err, userId }, '[BannedUsers] Redis недоступний, використовуємо DB fallback');

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isBanned: true },
      });

      return Boolean(user?.isBanned);
    } catch (dbErr) {
      logger.error({ err: dbErr, userId }, '[BannedUsers] DB fallback failed, denying access');
      throw createError.serverUnavailable('Authorization check failed due to unavailable data stores');
    }
  }
}

module.exports = { markUserAsBanned, unmarkUserAsBanned, isUserBanned };
