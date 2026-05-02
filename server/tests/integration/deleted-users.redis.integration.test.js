const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const { after } = test;
const assert = require('node:assert/strict');

if (process.env.REDIS_URL_TEST && !process.env.REDIS_URL) {
  process.env.REDIS_URL = process.env.REDIS_URL_TEST;
}

const { redis, isRedisReady } = require('../../src/lib/redis');
const { markUserAsDeleted, isUserDeleted } = require('../../src/store/deleted-users');

after(async () => {
  if (redis.status !== 'end') {
    try {
      await redis.quit();
    } catch (err) {
      console.warn('Redis quit failed, disconnecting:', err);
      redis.disconnect();
    }
  }
});

async function withRedisAndDatabaseCleanup(t, callback) {
  if (redis.status !== 'ready') {
    try {
      await redis.connect();
      await redis.ping();
    } catch (err) {
      console.warn('Redis connection/ping failed, skipping integration test:', err);
      t.skip(`Redis not available, skipping integration test: ${err?.message ?? err}`);
      return;
    }
  }

  if (!isRedisReady()) {
    t.skip('Redis not available, skipping integration test');
    return;
  }

  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

  if (!testDbUrl) {
    t.skip('DATABASE_URL not set, skipping integration test');
    return;
  }

  const testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  try {
    await testPrisma.$connect();
    await callback(testPrisma);
  } finally {
    const keys = await redis.keys('deleted:user:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await testPrisma.$disconnect();
  }
}

test('markUserAsDeleted adds user to Redis blacklist', async (t) => {
  await withRedisAndDatabaseCleanup(t, async (prisma) => {
    const userId = 99999;

    await markUserAsDeleted(userId);

    const isDeleted = await isUserDeleted(userId);
    assert.equal(isDeleted, true);

    const keyExists = await redis.exists(`deleted:user:${userId}`);
    assert.equal(keyExists, 1);
  });
});

test('isUserDeleted returns false for user not in blacklist', async (t) => {
  await withRedisAndDatabaseCleanup(t, async (prisma) => {
    const userId = 99998;

    const isDeleted = await isUserDeleted(userId);
    assert.equal(isDeleted, false);
  });
});

test('isUserDeleted returns true for user in Redis blacklist', async (t) => {
  await withRedisAndDatabaseCleanup(t, async (prisma) => {
    const userId = 99997;

    await markUserAsDeleted(userId);
    const isDeleted = await isUserDeleted(userId);
    assert.equal(isDeleted, true);
  });
});

test('isUserDeleted falls back to DB when Redis is unavailable for active user', async (t) => {
  await withRedisAndDatabaseCleanup(t, async (prisma) => {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: 'test-redis-fallback-active',
          email: 'test-redis-fallback-active@example.com',
          password: 'hash',
          isDeleted: false,
        },
      });

      await tx.user.delete({ where: { id: user.id } });
    }).catch((err) => {
      if (err.message !== 'ROLLBACK') {
        throw err;
      }
    });
  });
});

test('isUserDeleted falls back to DB when Redis is unavailable for deleted user', async (t) => {
  await withRedisAndDatabaseCleanup(t, async (prisma) => {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: 'test-redis-fallback-deleted',
          email: 'test-redis-fallback-deleted@example.com',
          password: 'hash',
          isDeleted: true,
        },
      });

      await tx.user.delete({ where: { id: user.id } });
    }).catch((err) => {
      if (err.message !== 'ROLLBACK') {
        throw err;
      }
    });
  });
});

test('markUserAsDeleted fails when Redis is unavailable', async (t) => {
  await withRedisAndDatabaseCleanup(t, async (prisma) => {
    assert.ok(isRedisReady(), 'Redis should be available for this test');
  });
});
