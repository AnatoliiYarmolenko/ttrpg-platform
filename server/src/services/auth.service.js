const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret } = require('../config/config');
const emailService = require('./email.service');
const { checkRefreshRateLimit } = require('./rate-limit.service');
const { createError, AppError, ERROR_CODES } = require('../constants/errors');
const { isUserDeleted } = require('../store/deleted-users');
const { redis } = require('../lib/redis');
const { logger } = require('../lib/logger');
const { getTokenCandidates, createRawAndHashedToken } = require('../utils/token.helper');
const { PASSWORD_HASH_ROUNDS, TOKEN_TTL_MS } = require('../config/tokens.config');

const createAuthVerificationService = require('./auth/auth-verification.service');
const createAuthCredentialsService = require('./auth/auth-credentials.service');
const createAuthTokenService = require('./auth/auth-token.service');
const createAuthPasswordService = require('./auth/auth-password.service');

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

async function acquireRefreshLock(userId, ttlMs = 5000) {
  const lockKey = `lock:refresh:${userId}`;
  const lockValue = crypto.randomBytes(16).toString('hex');
  const result = await redis.set(lockKey, lockValue, 'NX', 'PX', ttlMs);
  return result === 'OK' ? lockValue : null;
}

async function releaseRefreshLock(userId, lockValue) {
  const lockKey = `lock:refresh:${userId}`;
  const luaScript = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(luaScript, 1, lockKey, lockValue);
}

class AuthService {
  constructor() {
    const deps = {
      prisma,
      bcrypt,
      jwt,
      jwtSecret,
      emailService,
      checkRefreshRateLimit,
      createError,
      AppError,
      ERROR_CODES,
      isUserDeleted,
      logger,
      getTokenCandidates,
      createRawAndHashedToken,
      PASSWORD_HASH_ROUNDS,
      TOKEN_TTL_MS,
      acquireRefreshLock,
      releaseRefreshLock,
    };

    this.verificationService = createAuthVerificationService(deps);
    this.credentialsService = createAuthCredentialsService(deps);
    this.tokenService = createAuthTokenService(deps);
    this.passwordService = createAuthPasswordService(deps);
  }

  async verifyEmailToken(token) {
    return this.verificationService.verifyEmailToken(token);
  }

  async resendVerificationEmail(email) {
    return this.verificationService.resendVerificationEmail(email, normalizeEmail);
  }

  async registerUser(username, email, password) {
    return this.credentialsService.registerUser(username, email, password, normalizeEmail, emailService);
  }

  async loginUser(email, password) {
    return this.credentialsService.loginUser(email, password, normalizeEmail);
  }

  async refreshTokens(oldRefreshToken) {
    return this.tokenService.refreshTokens(oldRefreshToken);
  }

  async revokeRefreshToken(refreshToken) {
    return this.tokenService.revokeRefreshToken(refreshToken);
  }

  async requestPasswordReset(email) {
    return this.passwordService.requestPasswordReset(email, normalizeEmail);
  }

  async resetPassword(resetToken, newPassword) {
    return this.passwordService.resetPassword(resetToken, newPassword);
  }
}

module.exports = new AuthService();
