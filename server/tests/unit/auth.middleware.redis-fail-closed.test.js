const test = require('node:test');
const assert = require('node:assert/strict');

const authMiddlewarePath = require.resolve('../../src/middlewares/auth.middleware');
const jwtPath = require.resolve('jsonwebtoken');
const configPath = require.resolve('../../src/config/config');
const deletedUsersPath = require.resolve('../../src/store/deleted-users');

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function loadAuthMiddlewareWithMocks({ jwtVerifyMock, isUserDeletedMock }) {
  const originalAuthMiddlewareCache = require.cache[authMiddlewarePath];
  const originalJwtCache = require.cache[jwtPath];
  const originalConfigCache = require.cache[configPath];
  const originalDeletedUsersCache = require.cache[deletedUsersPath];

  delete require.cache[authMiddlewarePath];

  const originalJwtExports = originalJwtCache ? originalJwtCache.exports : require(jwtPath);

  require.cache[jwtPath] = {
    id: jwtPath,
    filename: jwtPath,
    loaded: true,
    exports: {
      ...originalJwtExports,
      verify: jwtVerifyMock,
    },
  };

  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: {
      jwtSecret: 'test-jwt-secret',
    },
  };

  require.cache[deletedUsersPath] = {
    id: deletedUsersPath,
    filename: deletedUsersPath,
    loaded: true,
    exports: {
      isUserDeleted: isUserDeletedMock,
    },
  };

  try {
    return require('../../src/middlewares/auth.middleware');
  } finally {
    delete require.cache[authMiddlewarePath];

    if (originalJwtCache) {
      require.cache[jwtPath] = originalJwtCache;
    } else {
      delete require.cache[jwtPath];
    }

    if (originalConfigCache) {
      require.cache[configPath] = originalConfigCache;
    } else {
      delete require.cache[configPath];
    }

    if (originalDeletedUsersCache) {
      require.cache[deletedUsersPath] = originalDeletedUsersCache;
    } else {
      delete require.cache[deletedUsersPath];
    }

    if (originalAuthMiddlewareCache) {
      require.cache[authMiddlewarePath] = originalAuthMiddlewareCache;
    }
  }
}

test('authenticateToken returns 503 when deleted-user status check is unavailable', async () => {
  const { authenticateToken } = loadAuthMiddlewareWithMocks({
    jwtVerifyMock: (token, secret, callback) => callback(null, { id: 42, username: 'user' }),
    isUserDeletedMock: async () => {
      const error = new Error('Redis unavailable');
      error.status = 503;
      throw error;
    },
  });

  const req = {
    cookies: {
      token: 'access-token',
    },
    headers: {},
  };
  const res = createMockResponse();

  let nextCalled = false;

  await new Promise((resolve) => {
    authenticateToken(req, res, () => {
      nextCalled = true;
      resolve();
    });

    setImmediate(resolve);
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body?.code, 'SERVER_UNAVAILABLE');
});

test('authenticateToken allows access when token is valid and user is not deleted (happy path)', async () => {
  const { authenticateToken } = loadAuthMiddlewareWithMocks({
    jwtVerifyMock: (token, secret, callback) => callback(null, { id: 42, username: 'user' }),
    isUserDeletedMock: async () => false,
  });

  const req = {
    cookies: {
      token: 'valid-token',
    },
    headers: {},
  };
  const res = createMockResponse();

  let nextCalled = false;

  await new Promise((resolve) => {
    authenticateToken(req, res, () => {
      nextCalled = true;
      resolve();
    });
  });

  assert.equal(nextCalled, true);
  assert.equal(req.user.id, 42);
  assert.equal(req.user.username, 'user');
});

test('authenticateToken denies access when user is deleted', async () => {
  const { authenticateToken } = loadAuthMiddlewareWithMocks({
    jwtVerifyMock: (token, secret, callback) => callback(null, { id: 42, username: 'user' }),
    isUserDeletedMock: async () => true,
  });

  const req = {
    cookies: {
      token: 'valid-token',
    },
    headers: {},
  };
  const res = createMockResponse();

  let nextCalled = false;

  await new Promise((resolve) => {
    authenticateToken(req, res, () => {
      nextCalled = true;
      resolve();
    });

    setImmediate(resolve);
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body?.code, 'AUTH_TOKEN_INVALID');
  assert.equal(res.body?.canRefresh, false);
});
