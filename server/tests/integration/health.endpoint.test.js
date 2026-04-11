const test = require('node:test');
const assert = require('node:assert/strict');

const appPath = require.resolve('../../src/app');
const redisPath = require.resolve('../../src/lib/redis');

function loadCreateAppWithRedisHealthState(redisHealthState) {
  const originalAppCache = require.cache[appPath];
  const originalRedisCache = require.cache[redisPath];

  delete require.cache[appPath];
  require.cache[redisPath] = {
    id: redisPath,
    filename: redisPath,
    loaded: true,
    exports: {
      getRedisHealthState: () => redisHealthState,
      isRedisReady: () => redisHealthState.isReady,
      redis: {},
      connectRedis: async () => {},
      waitForRedisReady: async () => true,
      recordRedisDegradation: () => {},
    },
  };

  try {
    return require('../../src/app').createApp;
  } finally {
    delete require.cache[appPath];

    if (originalRedisCache) {
      require.cache[redisPath] = originalRedisCache;
    } else {
      delete require.cache[redisPath];
    }

    if (originalAppCache) {
      require.cache[appPath] = originalAppCache;
    }
  }
}

test('GET /health returns ok payload when Redis is ready', async () => {
  const createApp = loadCreateAppWithRedisHealthState({
    isReady: true,
    status: 'ready',
    circuit: { open: false },
    degradationEvents: { total: 0, byFeature: {} },
  });

  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.status, 'ok');
    assert.ok(body.timestamp);
    assert.equal(body.redis.isReady, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /health returns degraded when Redis is not ready', async () => {
  const createApp = loadCreateAppWithRedisHealthState({
    isReady: false,
    status: 'reconnecting',
    circuit: { open: true },
    degradationEvents: { total: 1, byFeature: { 'rate-limit': 1 } },
  });

  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    assert.equal(response.status, 503);

    const body = await response.json();
    assert.equal(body.status, 'degraded');
    assert.ok(body.timestamp);
    assert.equal(body.redis.isReady, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
