const test = require('node:test');
const assert = require('node:assert/strict');

const { ERROR_CODES } = require('../../src/constants/errors');
const { verifyCSRFToken } = require('../../src/middlewares/csrf.middleware');

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

test('verifyCSRFToken rejects unsafe request with mismatched cookie and header tokens', () => {
  const req = {
    method: 'POST',
    cookies: {
      'XSRF-TOKEN': 'cookie-token',
    },
    headers: {
      'x-csrf-token': 'header-token',
    },
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
  assert.equal(res.cookies.length, 0);
});

test('verifyCSRFToken skips CSRF checks for GET requests', () => {
  const req = {
    method: 'GET',
    cookies: {},
    headers: {},
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

test('verifyCSRFToken skips CSRF checks for HEAD requests', () => {
  const req = {
    method: 'HEAD',
    cookies: {},
    headers: {},
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

test('verifyCSRFToken skips CSRF checks for OPTIONS requests', () => {
  const req = {
    method: 'OPTIONS',
    cookies: {},
    headers: {},
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

test('verifyCSRFToken enforces CSRF for PUT requests', () => {
  const csrfToken = 'put-token';
  const req = {
    method: 'PUT',
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

test('verifyCSRFToken enforces CSRF for DELETE requests', () => {
  const csrfToken = 'delete-token';
  const req = {
    method: 'DELETE',
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

test('verifyCSRFToken rejects POST with missing header token', () => {
  const req = {
    method: 'POST',
    cookies: {
      'XSRF-TOKEN': 'cookie-token',
    },
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
});

test('verifyCSRFToken rejects POST with missing cookie token', () => {
  const req = {
    method: 'POST',
    cookies: {},
    headers: {
      'x-csrf-token': 'header-token',
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  verifyCSRFToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.code, ERROR_CODES.SECURITY_CSRF_INVALID);
});

test('verifyCSRFToken accepts X-CSRF-Token header variant', () => {
  const csrfToken = 'header-variant-token';
  const req = {
    method: 'POST',
    cookies: {
      'XSRF-TOKEN': csrfToken,
    },
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  verifyCSRFToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});

test('verifyCSRFToken accepts x-xsrf-token header variant', () => {
  const csrfToken = 'xsrf-variant-token';
  const req = {
    method: 'POST',
    cookies: {
      'XSRF-TOKEN': csrfToken,
    },
    headers: {
      'x-xsrf-token': csrfToken,
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  verifyCSRFToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200);
});
