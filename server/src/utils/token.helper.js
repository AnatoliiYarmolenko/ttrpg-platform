const crypto = require('node:crypto');

function resolveShareTokenSecret() {
  const secret = process.env.SHARE_TOKEN_SECRET || process.env.SERVER_SECRET || process.env.JWT_SECRET;

  if (secret) {
    return secret;
  }

  // Node test runner executes isolated files where .env may be absent.
  if (typeof process.env.NODE_TEST_CONTEXT === 'string') {
    return 'test-share-token-secret';
  }

  return null;
}

function getShareTokenEncryptionKey() {
  const shareTokenSecret = resolveShareTokenSecret();

  if (!shareTokenSecret) {
    throw new Error('SHARE_TOKEN_SECRET or SERVER_SECRET must be configured for share token encryption');
  }

  return crypto.createHash('sha256').update(shareTokenSecret).digest();
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getTokenCandidates(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return [];
  }

  const normalized = token.trim();
  if (!normalized) {
    return [];
  }

  const hashed = hashToken(normalized);
  return normalized === hashed ? [normalized] : [normalized, hashed];
}

function createRawAndHashedToken(bytes = 32) {
  const rawToken = crypto.randomBytes(bytes).toString('hex');
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
  };
}

function createRawAndHashedShareToken(bytes = 24) {
  const rawToken = crypto.randomBytes(bytes).toString('base64url');
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
  };
}

function encryptShareToken(rawToken) {
  const key = getShareTokenEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(rawToken), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

function decryptShareToken(encryptedToken) {
  const serialized = String(encryptedToken || '').trim();

  if (!serialized) {
    throw new Error('Encrypted share token is empty');
  }

  const [ivPart, authTagPart, ciphertextPart] = serialized.split('.');
  if (!ivPart || !authTagPart || !ciphertextPart) {
    throw new Error('Encrypted share token payload is malformed');
  }

  const key = getShareTokenEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivPart, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}

function createRawEncryptedAndHashedShareToken(bytes = 24) {
  const { rawToken, tokenHash } = createRawAndHashedShareToken(bytes);
  return {
    rawToken,
    tokenHash,
    tokenEncrypted: encryptShareToken(rawToken),
  };
}

module.exports = {
  hashToken,
  getTokenCandidates,
  createRawAndHashedToken,
  createRawAndHashedShareToken,
  encryptShareToken,
  decryptShareToken,
  createRawEncryptedAndHashedShareToken,
};
