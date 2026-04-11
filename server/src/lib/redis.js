const Redis = require('ioredis');
const { logger } = require('./logger');

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
 * При недоступності Redis — операції повертають помилку, а консьюмери
 * обирають політику деградації (fail-closed для security-critical сценаріїв).
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CIRCUIT_ERROR_THRESHOLD = Number(process.env.REDIS_CIRCUIT_ERROR_THRESHOLD || 5);
const CIRCUIT_COOLDOWN_MS = Number(process.env.REDIS_CIRCUIT_COOLDOWN_MS || 30000);
const REDIS_READY_MAX_ATTEMPTS = Number(process.env.REDIS_READY_MAX_ATTEMPTS || 30);
const REDIS_READY_DELAY_MS = Number(process.env.REDIS_READY_DELAY_MS || 2000);

const redisHealthState = {
  lastReadyAt: null,
  lastErrorAt: null,
  consecutiveErrors: 0,
  circuitOpenAt: null,
  degradationEvents: {
    total: 0,
    byFeature: {},
  },
};

let redisConnectPromise = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function connectRedis() {
  if (redis.status === 'ready') {
    return Promise.resolve();
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redis.connect().catch((err) => {
      redisConnectPromise = null;
      throw err;
    });
  }

  return redisConnectPromise;
}

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
  logger.info('Redis підключено');
});

redis.on('ready', () => {
  redisHealthState.lastReadyAt = new Date().toISOString();
  redisHealthState.consecutiveErrors = 0;
  redisHealthState.circuitOpenAt = null;
  logger.info('Redis готовий до роботи');
});

redis.on('error', (err) => {
  redisHealthState.lastErrorAt = new Date().toISOString();
  redisHealthState.consecutiveErrors += 1;
  if (
    redisHealthState.consecutiveErrors >= CIRCUIT_ERROR_THRESHOLD
    && !redisHealthState.circuitOpenAt
  ) {
    redisHealthState.circuitOpenAt = Date.now();
    logger.warn(
      {
        consecutiveErrors: redisHealthState.consecutiveErrors,
        threshold: CIRCUIT_ERROR_THRESHOLD,
      },
      'Redis circuit відкрито через повторні помилки'
    );
  }
  // Логуємо, але не кидаємо — сервер продовжує роботу
  logger.error({ err }, 'Redis помилка');
});

redis.on('close', () => {
  logger.warn('Redis з\'єднання закрито');
});

redis.on('reconnecting', () => {
  logger.warn('Redis перепідключення');
});

function isCircuitOpen() {
  if (!redisHealthState.circuitOpenAt) {
    return false;
  }

  const elapsed = Date.now() - redisHealthState.circuitOpenAt;
  if (elapsed < CIRCUIT_COOLDOWN_MS) {
    return true;
  }

  // Даємо Redis шанс відновитися після cooldown-вікна.
  redisHealthState.circuitOpenAt = null;
  redisHealthState.consecutiveErrors = 0;
  return false;
}

/**
 * Перевіряє, чи Redis зараз доступний
 * @returns {boolean}
 */
function isRedisReady() {
  return redis.status === 'ready' && !isCircuitOpen();
}

async function waitForRedisReady(options = {}) {
  const maxAttempts = options.maxAttempts || REDIS_READY_MAX_ATTEMPTS;
  const delayMs = options.delayMs || REDIS_READY_DELAY_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await connectRedis();
      await redis.ping();

      if (isRedisReady()) {
        logger.info({ attempt }, 'Redis готовий до роботи перед стартом сервера');
        return true;
      }

      throw new Error('Redis is not ready yet');
    } catch (err) {
      const isLastAttempt = attempt === maxAttempts;
      logger.warn(
        { attempt, maxAttempts, delayMs, err },
        'Очікуємо готовність Redis перед стартом'
      );

      if (isLastAttempt) {
        throw err;
      }

      await sleep(delayMs);
    }
  }

  return false;
}

function recordRedisDegradation(feature, err = null) {
  redisHealthState.degradationEvents.total += 1;
  redisHealthState.degradationEvents.byFeature[feature] =
    (redisHealthState.degradationEvents.byFeature[feature] || 0) + 1;

  logger.warn(
    {
      feature,
      total: redisHealthState.degradationEvents.total,
      featureCount: redisHealthState.degradationEvents.byFeature[feature],
      redisStatus: redis.status,
      circuitOpen: isCircuitOpen(),
      err,
    },
    'Redis degradation recorded'
  );
}

function getRedisHealthState() {
  return {
    status: redis.status,
    isReady: isRedisReady(),
    circuit: {
      open: isCircuitOpen(),
      errorThreshold: CIRCUIT_ERROR_THRESHOLD,
      cooldownMs: CIRCUIT_COOLDOWN_MS,
      consecutiveErrors: redisHealthState.consecutiveErrors,
      openedAt: redisHealthState.circuitOpenAt
        ? new Date(redisHealthState.circuitOpenAt).toISOString()
        : null,
    },
    lastReadyAt: redisHealthState.lastReadyAt,
    lastErrorAt: redisHealthState.lastErrorAt,
    degradationEvents: {
      total: redisHealthState.degradationEvents.total,
      byFeature: { ...redisHealthState.degradationEvents.byFeature },
    },
  };
}

module.exports = {
  redis,
  connectRedis,
  waitForRedisReady,
  isRedisReady,
  recordRedisDegradation,
  getRedisHealthState,
};
