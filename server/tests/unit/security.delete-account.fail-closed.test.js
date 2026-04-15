const test = require('node:test');
const assert = require('node:assert/strict');

const securityServicePath = require.resolve('../../src/services/security.service');
const prismaPath = require.resolve('../../src/lib/prisma');
const bcryptPath = require.resolve('bcryptjs');
const deletedUsersPath = require.resolve('../../src/store/deleted-users');
const uploadServicePath = require.resolve('../../src/services/upload.service');
const { createError } = require('../../src/constants/errors');

function buildTxMock() {
  return {
    refreshToken: { deleteMany: async () => ({ count: 0 }) },
    emailVerificationToken: { deleteMany: async () => ({ count: 0 }) },
    emailChangeToken: { deleteMany: async () => ({ count: 0 }) },
    joinRequest: {
      updateMany: async () => ({ count: 0 }),
      deleteMany: async () => ({ count: 0 }),
    },
    session: { updateMany: async () => ({ count: 0 }) },
    campaign: { updateMany: async () => ({ count: 0 }) },
    wallet: {
      findUnique: async () => null,
      delete: async () => ({}),
    },
    transaction: { deleteMany: async () => ({ count: 0 }) },
    user: { update: async () => ({ id: 42 }) },
    userStats: { deleteMany: async () => ({ count: 0 }) },
  };
}

function loadSecurityServiceWithMocks({ prismaMock, bcryptMock, deletedUsersMock, uploadMock }) {
  const originalSecurityServiceCache = require.cache[securityServicePath];
  const originalPrismaCache = require.cache[prismaPath];
  const originalBcryptCache = require.cache[bcryptPath];
  const originalDeletedUsersCache = require.cache[deletedUsersPath];
  const originalUploadServiceCache = require.cache[uploadServicePath];

  delete require.cache[securityServicePath];

  require.cache[prismaPath] = {
    id: prismaPath,
    filename: prismaPath,
    loaded: true,
    exports: { prisma: prismaMock },
  };

  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: bcryptMock,
  };

  require.cache[deletedUsersPath] = {
    id: deletedUsersPath,
    filename: deletedUsersPath,
    loaded: true,
    exports: deletedUsersMock,
  };

  require.cache[uploadServicePath] = {
    id: uploadServicePath,
    filename: uploadServicePath,
    loaded: true,
    exports: uploadMock,
  };

  try {
    return require('../../src/services/security.service');
  } finally {
    delete require.cache[securityServicePath];

    if (originalPrismaCache) {
      require.cache[prismaPath] = originalPrismaCache;
    } else {
      delete require.cache[prismaPath];
    }

    if (originalBcryptCache) {
      require.cache[bcryptPath] = originalBcryptCache;
    } else {
      delete require.cache[bcryptPath];
    }

    if (originalDeletedUsersCache) {
      require.cache[deletedUsersPath] = originalDeletedUsersCache;
    } else {
      delete require.cache[deletedUsersPath];
    }

    if (originalUploadServiceCache) {
      require.cache[uploadServicePath] = originalUploadServiceCache;
    } else {
      delete require.cache[uploadServicePath];
    }

    if (originalSecurityServiceCache) {
      require.cache[securityServicePath] = originalSecurityServiceCache;
    }
  }
}

test('deleteAccount fails closed and rolls back transaction when Redis mark fails', async () => {
  let rollbackTriggered = false;
  let markCalled = 0;

  const prismaMock = {
    user: {
      findUnique: async () => ({
        password: 'stored-hash',
        username: 'demo',
        email: 'demo@example.com',
        avatarUrl: null,
      }),
    },
    campaign: {
      count: async () => 0,
    },
    $transaction: async (callback) => {
      const tx = buildTxMock();
      try {
        return await callback(tx);
      } catch (err) {
        rollbackTriggered = true;
        throw err;
      }
    },
  };

  const service = loadSecurityServiceWithMocks({
    prismaMock,
    bcryptMock: {
      compare: async () => true,
      hash: async () => 'anonymous-password-hash',
    },
    deletedUsersMock: {
      markUserAsDeleted: async () => {
        markCalled += 1;
        throw createError.serverUnavailable();
      },
    },
    uploadMock: {
      deleteOldAvatar: async () => {},
    },
  });

  await assert.rejects(
    () => service.deleteAccount(42, 'valid-password'),
    (error) => {
      assert.equal(error.code, 'SERVER_UNAVAILABLE');
      assert.equal(error.status, 503);
      return true;
    }
  );

  assert.equal(markCalled, 1);
  assert.equal(rollbackTriggered, true);
});
