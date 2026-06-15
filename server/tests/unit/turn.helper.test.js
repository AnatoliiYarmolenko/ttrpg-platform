const { test, describe, mock } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const SHARED_SECRET = 'test_secret_long_enough_for_hmac_32ch';
const TTL_SECONDS = 3600;

function loadHelperWithConfig(t, configMock) {
  const helperPath = require.resolve('../../src/utils/turn.helper');
  const configPath = require.resolve('../../src/config/config');

  const origHelper = require.cache[helperPath];
  const origConfig = require.cache[configPath];

  delete require.cache[helperPath];
  require.cache[configPath] = {
    id: configPath,
    filename: configPath,
    loaded: true,
    exports: configMock,
  };

  t.after(() => {
    delete require.cache[helperPath];
    if (origConfig) require.cache[configPath] = origConfig;
    else delete require.cache[configPath];
    if (origHelper) require.cache[helperPath] = origHelper;
  });

  return require('../../src/utils/turn.helper');
}

function computeExpectedCredential(username, secret) {
  return crypto.createHmac('sha1', secret).update(username).digest('base64');
}

describe('generateTurnCredentials', () => {
  test('returns object with username and password string fields', (t) => {
    const { generateTurnCredentials } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: TTL_SECONDS,
    });

    const result = generateTurnCredentials(42);

    assert.ok(Object.hasOwn(result, 'username'));
    assert.ok(Object.hasOwn(result, 'password'));
    assert.equal(typeof result.username, 'string');
    assert.equal(typeof result.password, 'string');
  });

  test('username format is "<expiry_timestamp>:<userId>"', (t) => {
    const { generateTurnCredentials } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: TTL_SECONDS,
    });

    const before = Math.floor(Date.now() / 1000);
    const { username } = generateTurnCredentials(7);
    const after = Math.floor(Date.now() / 1000);

    const parts = username.split(':');
    assert.equal(parts.length, 2, 'username must have exactly one colon separator');

    const expiry = Number(parts[0]);
    const uid = parts[1];

    assert.ok(Number.isInteger(expiry), 'expiry part must be an integer');
    assert.ok(expiry >= before + TTL_SECONDS, 'expiry must be at least now + TTL');
    assert.ok(expiry <= after + TTL_SECONDS, 'expiry must not exceed now + TTL + clock drift');
    assert.equal(uid, '7');
  });

  test('password is base64 HMAC-SHA1 of username signed with shared secret', (t) => {
    const { generateTurnCredentials } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: TTL_SECONDS,
    });

    const { username, password } = generateTurnCredentials(99);

    assert.equal(password, computeExpectedCredential(username, SHARED_SECRET));
  });

  test('different userIds produce different usernames and passwords', (t) => {
    const { generateTurnCredentials } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: TTL_SECONDS,
    });

    const a = generateTurnCredentials(1);
    const b = generateTurnCredentials(2);

    assert.notEqual(a.username, b.username);
    assert.notEqual(a.password, b.password);
  });

  test('string userId is preserved as-is in username', (t) => {
    const { generateTurnCredentials } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: TTL_SECONDS,
    });

    const { username } = generateTurnCredentials('abc-user');

    assert.ok(username.endsWith(':abc-user'), `expected ":abc-user" suffix, got "${username}"`);
  });

  test('wrong secret produces different password for the same username', (t) => {
    const { generateTurnCredentials } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: TTL_SECONDS,
    });

    const { username, password } = generateTurnCredentials(5);
    const wrongPassword = computeExpectedCredential(username, 'wrong_secret_totally_different!!');

    assert.notEqual(password, wrongPassword);
  });

  test('longer TTL produces a later expiry timestamp', (t) => {
    const { generateTurnCredentials: gen1 } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: 1800,
    });
    const { generateTurnCredentials: gen2 } = loadHelperWithConfig(t, {
      turnSharedSecret: SHARED_SECRET,
      turnCredentialTtlSeconds: 7200,
    });

    const expiry1 = Number(gen1(1).username.split(':')[0]);
    const expiry2 = Number(gen2(1).username.split(':')[0]);

    assert.ok(expiry2 > expiry1, 'longer TTL must produce a later expiry');
  });
});
