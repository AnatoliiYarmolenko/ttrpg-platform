const test = require('node:test');
const assert = require('node:assert/strict');

const deletedUsersPath = require.resolve('../../src/store/deleted-users');
const redisLibPath = require.resolve('../../src/lib/redis');
const prismaPath = require.resolve('../../src/lib/prisma');

function loadDeletedUsersWithMocks({ redisMock, prismaMock }) {
  const originalDeletedUsersCache = require.cache[deletedUsersPath];
  const originalRedisCache = require.cache[redisLibPath];
  const originalPrismaCache = require.cache[prismaPath];

  delete require.cache[deletedUsersPath];
  require.cache[redisLibPath] = {
    id: redisLibPath,
    filename: redisLibPath,
    loaded: true,
    exports: redisMock,
  };

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { prisma: prismaMock },
  };

  try {
    return require('../../src/store/deleted-users');
  } finally {
    delete require.cache[deletedUsersPath];
    if (originalRedisCache) {
      require.cache[redisLibPath] = originalRedisCache;
    } else {
      delete require.cache[redisLibPath];
    }

    if (originalPrismaCache) {
      require.cache[prismaPath] = originalPrismaCache;
    } else {
      delete require.cache[prismaPath];
    }

    if (originalDeletedUsersCache) {
      require.cache[deletedUsersPath] = originalDeletedUsersCache;
    }
  }
}

test('isUserDeleted falls back to DB and returns true for deleted accounts when Redis is unavailable', async () => {
  const deletedUsersStore = loadDeletedUsersWithMocks({
    redisMock: {
      exists: async () => 0,
      recordRedisDegradation: () => {},
      isRedisReady: () => false,
    },
    prismaMock: {
      user: {
        findUnique: async () => ({ isDeleted: true }),
      },
    },
  });

  const isDeleted = await deletedUsersStore.isUserDeleted(123);

  assert.equal(isDeleted, true);
});

test('isUserDeleted falls back to DB and returns false for active accounts when Redis is unavailable', async () => {
  const deletedUsersStore = loadDeletedUsersWithMocks({
    redisMock: {
      exists: async () => 0,
      recordRedisDegradation: () => {},
      isRedisReady: () => false,
    },
    prismaMock: {
      user: {
        findUnique: async () => ({ isDeleted: false }),
      },
    },
  });

  const isDeleted = await deletedUsersStore.isUserDeleted(123);

  assert.equal(isDeleted, false);
});
