const test = require('node:test');
const assert = require('node:assert/strict');

const { ingestClientLog } = require('../src/controllers/clientLogs.controller');
const { logger } = require('../src/lib/logger');

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
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

test('ingestClientLog keeps structured meta and user context for object payloads', async () => {
  const calls = [];
  const originalWarn = logger.warn;

  logger.warn = (...args) => {
    calls.push(args);
  };

  try {
    const req = {
      body: {
        level: 'warn',
        message: 'Registration failed',
        path: '/register',
        meta: {
          code: 'AUTH_DUPLICATE_EMAIL',
          response: {
            status: 409,
          },
        },
      },
      user: {
        id: 42,
      },
      get(headerName) {
        return headerName === 'user-agent' ? 'test-agent' : undefined;
      },
    };
    const res = createMockResponse();

    await ingestClientLog(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.equal(res.statusCode, 202);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(calls.length, 1);

    const [payload, message] = calls[0];
    assert.equal(message, '[Client] Registration failed');
    assert.equal(payload.source, 'client');
    assert.equal(payload.userId, 42);
    assert.equal(payload.userAgent, 'test-agent');
    assert.equal(payload.path, '/register');
    assert.deepEqual(payload.meta, {
      code: 'AUTH_DUPLICATE_EMAIL',
      response: {
        status: 409,
      },
    });
  } finally {
    logger.warn = originalWarn;
  }
});

test('ingestClientLog wraps array meta so logger payload stays searchable', async () => {
  const calls = [];
  const originalError = logger.error;

  logger.error = (...args) => {
    calls.push(args);
  };

  try {
    const req = {
      body: {
        level: 'error',
        message: 'Axios request failed',
        path: '/login',
        meta: [
          {
            status: 403,
          },
          'csrf mismatch',
        ],
      },
      get() {
        return 'test-agent';
      },
    };
    const res = createMockResponse();

    await ingestClientLog(req, res, () => {
      throw new Error('next should not be called');
    });

    assert.equal(res.statusCode, 202);
    assert.equal(calls.length, 1);

    const [payload, message] = calls[0];
    assert.equal(message, '[Client] Axios request failed');
    assert.deepEqual(payload.meta, {
      items: [
        {
          status: 403,
        },
        'csrf mismatch',
      ],
    });
  } finally {
    logger.error = originalError;
  }
});

test('ingestClientLog rejects empty message payloads', async () => {
  const req = {
    body: {
      level: 'error',
      message: null,
    },
    get() {
      return 'test-agent';
    },
  };
  const res = createMockResponse();

  await ingestClientLog(req, res, () => {
    throw new Error('next should not be called');
  });

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'message is required' });
});
