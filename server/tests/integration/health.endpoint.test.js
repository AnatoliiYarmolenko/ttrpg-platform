const test = require('node:test');
const assert = require('node:assert/strict');

const { createApp } = require('../../src/app');

test('GET /health returns valid response structure (HTTP contract)', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    const body = await response.json();

    assert.ok([200, 503].includes(response.status), 'Status should be 200 or 503');
    assert.ok(typeof body === 'object', 'Response should be an object');
    assert.ok(['ok', 'degraded'].includes(body.status), 'Status should be ok or degraded');
    assert.ok(typeof body.timestamp === 'string', 'Timestamp should be a string');
    assert.ok(typeof body.redis === 'object', 'Redis should be an object');
    assert.ok(typeof body.redis.isReady === 'boolean', 'Redis.isReady should be a boolean');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('GET /health returns JSON content-type', async () => {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/health`);

    assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Content-Type should be application/json');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
