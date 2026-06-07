const jwt = require('jsonwebtoken');
const { promisify } = require('node:util');
const { AppError, ERROR_CODES } = require('../constants/errors');
const { logger } = require('../lib/logger');
const { COOKIE_NAMES } = require('../utils/cookie.helper');
const { jwtSecret, corsAllowedOrigins, nodeEnv } = require('../config/config');
const { isUserDeleted } = require('../store/deleted-users');
const { isUserBanned } = require('../store/banned-users');
const prismaModule = require('../lib/prisma');

const verifyJwt = promisify(jwt.verify);
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function normalizeOrigin(origin) {
  return typeof origin === 'string' ? origin.replace(/\/$/, '') : origin;
}

function isDevLocalhostOrigin(origin) {
  if (nodeEnv === 'production') {
    return false;
  }

  try {
    const parsed = new URL(origin);
    return LOCALHOST_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedConfiguredOrigin(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  const allowedOrigins = Array.isArray(corsAllowedOrigins)
    ? corsAllowedOrigins.map(normalizeOrigin)
    : [];

  return allowedOrigins.includes(normalizedOrigin);
}

function parseCookies(headerValue) {
  if (!headerValue) {
    return {};
  }

  return headerValue.split(';').reduce((acc, item) => {
    const trimmed = item.trim();
    if (!trimmed) {
      return acc;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      return acc;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (!key) {
      return acc;
    }

    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function ensureAllowedOrigin(request) {
  const origin = request.headers?.origin;

  if (!origin) {
    return;
  }

  if (isDevLocalhostOrigin(origin)) {
    return;
  }

  if (isAllowedConfiguredOrigin(origin)) {
    return;
  }

  logger.warn({ origin }, 'Blocked WS origin');
  throw new AppError(ERROR_CODES.SECURITY_CORS_BLOCKED);
}

async function authenticateWsRequest(request) {
  const cookies = parseCookies(request.headers?.cookie || '');
  let token = cookies[COOKIE_NAMES.ACCESS_TOKEN];

  if (!token) {
    const authHeader = request.headers?.authorization;
    token = authHeader?.split(' ')[1];
  }

  if (!token) {
    throw new AppError(ERROR_CODES.AUTH_TOKEN_MISSING);
  }

  try {
    const decoded = await verifyJwt(token, jwtSecret);

    if (await isUserDeleted(decoded.id)) {
      throw new AppError(ERROR_CODES.AUTH_TOKEN_INVALID, 'Акаунт було видалено');
    }

    if (await isUserBanned(decoded.id)) {
      throw new AppError(ERROR_CODES.USER_BANNED, 'Акаунт було заблоковано');
    }

    const user = await prismaModule.prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.AUTH_TOKEN_INVALID, 'Користувача не знайдено');
    }

    return user;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    if (err.name === 'TokenExpiredError') {
      throw new AppError(ERROR_CODES.AUTH_TOKEN_EXPIRED);
    }

    if (err.name === 'JsonWebTokenError') {
      throw new AppError(ERROR_CODES.AUTH_TOKEN_INVALID);
    }

    logger.error({ err }, '[WS Auth] Неочікувана помилка при верифікації токена');
    throw new AppError(ERROR_CODES.SERVER_UNAVAILABLE);
  }
}

module.exports = {
  authenticateWsRequest,
  ensureAllowedOrigin,
};
