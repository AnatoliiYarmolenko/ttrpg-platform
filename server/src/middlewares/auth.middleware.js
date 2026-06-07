const jwt = require('jsonwebtoken');
const { promisify } = require('node:util');
const { jwtSecret } = require('../config/config');
const { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } = require('../constants/errors');
const { isUserDeleted } = require('../store/deleted-users');
const { isUserBanned } = require('../store/banned-users');
const { logger } = require('../lib/logger');

const verifyJwt = promisify(jwt.verify);

const authenticateToken = async (req, res, next) => {
  let token = req.cookies?.token;

  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader?.split(' ')[1];
  }

  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: ERROR_MESSAGES[ERROR_CODES.AUTH_TOKEN_MISSING],
      code: ERROR_CODES.AUTH_TOKEN_MISSING,
    });
  }

  try {
    const user = await verifyJwt(token, jwtSecret);

    if (await isUserDeleted(user.id)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        error: 'Акаунт було видалено',
        canRefresh: false,
      });
    }

    if (await isUserBanned(user.id)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.USER_BANNED,
        error: ERROR_MESSAGES[ERROR_CODES.USER_BANNED],
        canRefresh: false,
      });
    }

    req.user = user;
    return next(); 
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.set('WWW-Authenticate', 'Bearer error="invalid_token", error_description="The access token expired"');
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        error: ERROR_MESSAGES[ERROR_CODES.AUTH_TOKEN_EXPIRED],
        canRefresh: true
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        error: ERROR_MESSAGES[ERROR_CODES.AUTH_TOKEN_INVALID],
        canRefresh: false
      });
    }
    logger.error({ err }, '[Auth] Неочікувана помилка при верифікації токена');
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      code: ERROR_CODES.SERVER_UNAVAILABLE,
      error: ERROR_MESSAGES[ERROR_CODES.SERVER_UNAVAILABLE],
      canRefresh: false,
    });
  }
};

const optionalAuthenticateToken = async (req, res, next) => {
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader?.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const user = await verifyJwt(token, jwtSecret);

    if (await isUserDeleted(user.id) || await isUserBanned(user.id)) {
      return next();
    }

    req.user = user;
    return next();
  } catch (err) {
    if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') {
      logger.warn({ err }, '[Auth] Optional auth пропущено через помилку перевірки');
    }
    return next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuthenticateToken,
};
