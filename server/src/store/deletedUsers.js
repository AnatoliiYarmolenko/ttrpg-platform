/**
 * In-memory blacklist видалених акаунтів.
 *
 * Зберігає Set userId, які були анонімізовані в поточному процесі.
 * Мета: закрити 15-хвилинне вікно між анонімізацією та інвалідацією JWT access token,
 * без звернення до БД на кожен запит.
 *
 * ⚠️  ОБМЕЖЕННЯ: при горизонтальному масштабуванні (кілька Node-процесів)
 *     Set не синхронізується між інстансами. Для production-кластера
 *     замінити на Redis SET з TTL, рівним max(accessToken TTL) = 15 хв.
 */
const _deletedUserIds = new Set();

/**
 * Додати userId до blacklist після анонімізації акаунту.
 * @param {number} userId
 */
function markUserAsDeleted(userId) {
  _deletedUserIds.add(userId);
}

/**
 * Перевірити, чи userId є в blacklist.
 * @param {number} userId
 * @returns {boolean}
 */
function isUserDeleted(userId) {
  return _deletedUserIds.has(userId);
}

module.exports = { markUserAsDeleted, isUserDeleted };
