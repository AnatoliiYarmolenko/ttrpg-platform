const crypto = require('crypto');

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

module.exports = {
  hashToken,
  getTokenCandidates,
  createRawAndHashedToken,
};