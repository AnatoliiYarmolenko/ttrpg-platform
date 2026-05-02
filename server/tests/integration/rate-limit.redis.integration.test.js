const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const test = require('node:test');
const assert = require('node:assert/strict');
const { after } = test;

if (process.env.REDIS_URL_TEST && !process.env.REDIS_URL) {
  process.env.REDIS_URL = process.env.REDIS_URL_TEST;
}

const { redis, isRedisReady } = require('../../src/lib/redis');
const { checkRateLimit, getRateLimitStatus, resetRateLimit } = require('../../src/services/rate-limit.service');

async function withRedisCleanup(callback) {
  if (redis.status !== 'ready') {
    try {
      await redis.connect();
      await redis.ping();
    } catch (err) {
      test.skip(`Redis not available, skipping integration test: ${err?.message || 'connection failed'}`);
      return;
    }
  }

  if (!isRedisReady()) {
    test.skip('Redis not available, skipping integration test');
    return;
  }

  try {
    await callback();
  } finally {
    const keys = await redis.keys('rateLimit:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

after(async () => {
  if (redis.status !== 'end') {
    try {
      await redis.quit();
    } catch (err) {
      test.diagnostic(`Redis quit failed during test teardown: ${err?.message || 'unknown error'}`);
      redis.disconnect();
    }
  }
});

test('checkRateLimit allows requests within limit with real Redis', async () => {
  await withRedisCleanup(async () => {
    const identifier = 'test-user-1';
    const type = 'auth_login';

    await resetRateLimit(type, identifier);

    for (let i = 0; i < 3; i++) {
      const allowed = await checkRateLimit(type, identifier, {
        maxRequests: 5,
        windowMs: 60_000,
        blockDurationMs: 60_000,
      });
      assert.equal(allowed, true, `Request ${i + 1} should be allowed`);
    }

    const status = await getRateLimitStatus(type, identifier);
    assert.equal(status.count, 3);
    assert.equal(status.isBlocked, false);
  });
});

test('checkRateLimit blocks when limit exceeded with real Redis', async () => {
  await withRedisCleanup(async () => {
    const identifier = 'test-user-2';
    const type = 'auth_login';

    await resetRateLimit(type, identifier);

    for (let i = 0; i < 6; i++) {
      try {
        await checkRateLimit(type, identifier, {
          maxRequests: 5,
          windowMs: 60_000,
          blockDurationMs: 60_000,
        });
      } catch (err) {
        if (i === 5) {
          assert.equal(err.status, 429);
          assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
        } else {
          throw err;
        }
      }
    }

    const status = await getRateLimitStatus(type, identifier);
    assert.equal(status.isBlocked, true);
    assert.ok(status.blockedSecondsRemaining > 0);
  });
});

test('checkRateLimit respects different identifiers with real Redis', async () => {
  await withRedisCleanup(async () => {
    const type = 'auth_login';

    await resetRateLimit(type, 'user-a');
    await resetRateLimit(type, 'user-b');

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(type, 'user-a', {
        maxRequests: 5,
        windowMs: 60_000,
        blockDurationMs: 60_000,
      });
    }

    for (let i = 0; i < 3; i++) {
      await checkRateLimit(type, 'user-b', {
        maxRequests: 5,
        windowMs: 60_000,
        blockDurationMs: 60_000,
      });
    }

    const statusA = await getRateLimitStatus(type, 'user-a');
    const statusB = await getRateLimitStatus(type, 'user-b');

    assert.equal(statusA.count, 3);
    assert.equal(statusB.count, 3);
    assert.equal(statusA.isBlocked, false);
    assert.equal(statusB.isBlocked, false);
  });
});

test('checkRateLimit handles security-critical types with fail-closed', async () => {
  await withRedisCleanup(async () => {
    const identifier = 'test-user-3';
    const type = 'auth_login';

    await resetRateLimit(type, identifier);

    const allowed = await checkRateLimit(type, identifier, {
      maxRequests: 5,
      windowMs: 60_000,
      blockDurationMs: 60_000,
    });

    assert.equal(allowed, true);
  });
});

test('checkRateLimit handles non-critical types with fail-open', async () => {
  await withRedisCleanup(async () => {
    const identifier = 'test-user-4';
    const type = 'profile_public_view';

    await resetRateLimit(type, identifier);

    const allowed = await checkRateLimit(type, identifier, {
      maxRequests: 100,
      windowMs: 60_000,
      blockDurationMs: 60_000,
    });

    assert.equal(allowed, true);
  });
});

test('resetRateLimit clears counters and blocks with real Redis', async () => {
  await withRedisCleanup(async () => {
    const identifier = 'test-user-5';
    const type = 'auth_login';

    await resetRateLimit(type, identifier);

    for (let i = 0; i < 6; i++) {
      try {
        await checkRateLimit(type, identifier, {
          maxRequests: 5,
          windowMs: 60_000,
          blockDurationMs: 60_000,
        });
      } catch (err) {
        if (i < 5) {
          throw err;
        }

        assert.equal(err.status, 429);
        assert.equal(err.code, 'RATE_LIMIT_EXCEEDED');
      }
    }

    let status = await getRateLimitStatus(type, identifier);
    assert.equal(status.isBlocked, true);

    await resetRateLimit(type, identifier);

    status = await getRateLimitStatus(type, identifier);
    assert.equal(status.count, 0);
    assert.equal(status.isBlocked, false);

    const allowed = await checkRateLimit(type, identifier, {
      maxRequests: 5,
      windowMs: 60_000,
      blockDurationMs: 60_000,
    });
    assert.equal(allowed, true);
  });
});
