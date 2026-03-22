const Redis = require('ioredis');

/**
 * Redis клієнт (singleton).
 *
 * Використовується для:
 *  - Blacklist видалених акаунтів (закриває 15-хв вікно JWT)
 *  - Rate limiting (refresh, login, passwordReset)
 *  - Distributed lock для refresh token rotation
 *
 * lazyConnect: true — з'єднання НЕ відкривається при імпорті модуля.
 * Явне підключення виконується з index.js через redis.connect().
 * Завдяки цьому тести, які імпортують сервіси, не тригерять Redis-з'єднання.
 *
 * При недоступності Redis — операції повертають помилку, яку консьюмери
 * ловлять і обробляють як fail-open.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, {
  // НЕ підключатися автоматично при імпорті — лише після явного redis.connect()
  lazyConnect: true,

  // Повторні спроби підключення: безкінечно з exponential backoff
  retryStrategy(times) {
    return Math.min(500 * 2 ** (times - 1), 8000); // 500ms → 1s → 2s → 4s → 8s
  },

  // Не ставити команди в чергу при відключеному Redis — повертати помилку одразу
  enableOfflineQueue: false,

  // Таймаут з'єднання
  connectTimeout: 5000,

  // Кількість ретраїв для окремих команд (не підключення)
  maxRetriesPerRequest: 1,
});

redis.on('connect', () => {
  console.log('✅ Redis підключено');
});

redis.on('ready', () => {
  console.log('✅ Redis готовий до роботи');
});

redis.on('error', (err) => {
  // Логуємо, але не кидаємо — сервер продовжує роботу
  console.error(`❌ Redis помилка: ${err.message}`);
});

redis.on('close', () => {
  console.warn('⚠️ Redis з\'єднання закрито');
});

redis.on('reconnecting', () => {
  console.warn('🔄 Redis перепідключення...');
});

/**
 * Перевіряє, чи Redis зараз доступний
 * @returns {boolean}
 */
function isRedisReady() {
  return redis.status === 'ready';
}

module.exports = { redis, isRedisReady };
