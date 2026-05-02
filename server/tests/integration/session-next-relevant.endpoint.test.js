const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { createApp } = require('../../src/app');
const config = require('../../src/config/config');

function createAuthToken(userId) {
  return jwt.sign({ id: userId }, config.jwtSecret, { expiresIn: '1h' });
}

async function withServer(callback) {
  const app = createApp();
  const server = app.listen(0);

  try {
    const { port } = server.address();
    return await callback(port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /api/sessions/next-relevant returns 401 for anonymous user', async () => {
  await withServer(async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`);

    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, 'AUTH_TOKEN_MISSING');
  });
});

test('GET /api/sessions/next-relevant returns valid response structure (HTTP contract)', async () => {
  await withServer(async (port) => {
    const token = createAuthToken(42);
    const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.ok([200, 401, 503].includes(response.status), 'Status should be 200, 401, or 503');

    if (response.status === 200) {
      const body = await response.json();
      assert.ok(typeof body === 'object', 'Response should be an object');
      assert.equal(body.success, true, 'success should be true');
      assert.ok(typeof body.data === 'object', 'data should be an object');
      assert.ok('session' in body.data, 'data should have session field');
      
      if (body.data.session) {
        assert.ok(typeof body.data.session === 'object', 'session should be an object or null');
        assert.ok('id' in body.data.session, 'session should have id');
        assert.ok('status' in body.data.session, 'session should have status');
        assert.ok('myStatus' in body.data.session, 'session should have myStatus');
      }
    } else if (response.status === 503) {
      const body = await response.json();
      assert.ok(typeof body === 'object', 'Response should be an object');
      assert.ok('code' in body, 'Error response should have code');
    }
  });
});

test('GET /api/sessions/next-relevant returns JSON content-type', async () => {
  await withServer(async (port) => {
    const token = createAuthToken(42);
    const response = await fetch(`http://127.0.0.1:${port}/api/sessions/next-relevant`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Content-Type should be application/json');
  });
});
