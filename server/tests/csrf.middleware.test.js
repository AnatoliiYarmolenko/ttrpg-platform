const test = require('node:test');
const assert = require('node:assert/strict');

const { ERROR_CODES } = require('../src/constants/errors');
const { verifyCSRFToken } = require('../src/middlewares/csrf.middleware');

function createMockResponse() {
  return {
    cookies: [],
    headers: {},
    statusCode: 200,
    body: null,
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
      return this;
    },
    getHeader(name) {
      return this.headers[name];
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

test('verifyCSRFToken rejects unsafe request without CSRF cookie and mints replacement token', () => {
  const req = {
    method: 'POST',
    cookies: {},
    headers: {},
  };
  const res = createMockResponse();
  let nextCalled = false;

  verifyCSRFToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.code, ERROR_CODES.SECURITY_CSRF_INVALID);
  assert.match(res.body?.error || '', /csrf/i);
  assert.equal(res.cookies.length, 1);
  assert.equal(res.cookies[0].name, 'XSRF-TOKEN');
  assert.ok(res.cookies[0].value);
  assert.equal(res.headers['X-CSRF-Token'], res.cookies[0].value);
});

test('verifyCSRFToken allows unsafe request with matching cookie and header tokens', () => {
  const csrfToken = 'known-token';
  const req = {
    method: 'PATCH',
    cookies: {
      'XSRF-TOKEN': csrfToken,
    },
    headers: {
      'x-csrf-token': csrfToken,
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  verifyCSRFToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, null);
});

test('verifyCSRFToken skips CSRF checks for bearer-only API clients', () => {
  const req = {
    method: 'DELETE',
    cookies: {},
    headers: {
      authorization: 'Bearer test-token',
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  verifyCSRFToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.cookies.length, 0);
  assert.equal(res.body, null);
});