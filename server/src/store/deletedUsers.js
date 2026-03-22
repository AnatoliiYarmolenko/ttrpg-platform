const { redis } = require('../lib/redis');

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
    await redis.set(`deleted:user:${userId}`, '1', 'EX', DELETED_USER_TTL_SECONDS);
  } catch (err) {
    // Не кидаємо помилку — акаунт вже анонімізовано в БД.
    // blacklist через in-memory Set як fallback не потрібен:
    // при помилці Redis краще просто залогувати.
    console.error(`[DeletedUsers] Redis помилка markUserAsDeleted(${userId}):`, err.message);
  }
}

/**
 * Перевірити, чи userId є в blacklist.
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
async function isUserDeleted(userId) {
  try {
    const result = await redis.exists(`deleted:user:${userId}`);
    return result === 1;
  } catch (err) {
    // При помилці Redis — fail-open (не блокуємо користувача).
    // Це менший ризик, ніж заблокувати всіх при недоступному Redis.
    console.error(`[DeletedUsers] Redis помилка isUserDeleted(${userId}):`, err.message);
    return false;
  }
}

module.exports = { markUserAsDeleted, isUserDeleted };
