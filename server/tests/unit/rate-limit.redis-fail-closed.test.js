const test = require('node:test');
const assert = require('node:assert/strict');

const rateLimitServicePath = require.resolve('../../src/services/rateLimit.service');
const redisLibPath = require.resolve('../../src/lib/redis');

function loadRateLimitServiceWithRedisMock(redisMock) {
  const originalRateLimitCache = require.cache[rateLimitServicePath];
  const originalRedisCache = require.cache[redisLibPath];

  delete require.cache[rateLimitServicePath];
  require.cache[redisLibPath] = {
    id: redisLibPath,
    filename: redisLibPath,
    loaded: true,
    exports: redisMock,
  };

  try {
    return require('../../src/services/rateLimit.service');
  } finally {
    delete require.cache[rateLimitServicePath];
    if (originalRedisCache) {
      require.cache[redisLibPath] = originalRedisCache;
    } else {
      delete require.cache[redisLibPath];
    }

    if (originalRateLimitCache) {
      require.cache[rateLimitServicePath] = originalRateLimitCache;
    }
  }
}

test('checkRateLimit fails closed for security-critical type when Redis is unavailable', async () => {
  const service = loadRateLimitServiceWithRedisMock({
    redis: {},
    isRedisReady: () => false,
    recordRedisDegradation: () => {},
  });

  await assert.rejects(
    () => service.checkRateLimit('auth_login', '127.0.0.1-user@example.com', {
      maxRequests: 5,
      windowMs: 60_000,
      blockDurationMs: 60_000,
    }),
    (error) => {
      assert.equal(error.code, 'RATE_LIMIT_UNAVAILABLE');
      assert.equal(error.status, 503);
      return true;
    }
  );
});

test('checkRateLimit remains fail-open for non-critical type when Redis is unavailable', async () => {
  const service = loadRateLimitServiceWithRedisMock({
    redis: {},
    isRedisReady: () => false,
    recordRedisDegradation: () => {},
  });

  const allowed = await service.checkRateLimit('profile_public_view', '127.0.0.1', {
    maxRequests: 100,
    windowMs: 60_000,
    blockDurationMs: 60_000,
  });

  assert.equal(allowed, true);
});
