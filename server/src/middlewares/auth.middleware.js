const jwt = require('jsonwebtoken');
const { promisify } = require('node:util');
const { jwtSecret } = require('../config/config');
const { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } = require('../constants/errors');
const { isUserDeleted } = require('../store/deleted-users');
const { logger } = require('../lib/logger');

const verifyJwt = promisify(jwt.verify);

/**
 * Middleware для верифікації JWT токена
 * Перевіряє наявність та валідність токена з httpOnly cookie або заголовка Authorization (для зворотної сумісності)
 */
const authenticateToken = async (req, res, next) => {
  // Спочатку пробуємо отримати токен з httpOnly cookie
  let token = req.cookies?.token;

  // Якщо токена немає в cookie, пробуємо з заголовка Authorization (для зворотної сумісності)
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader?.split(' ')[1]; // Формат: "Bearer <token>"
  }

  // Якщо токена немає взагалі
  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: ERROR_MESSAGES[ERROR_CODES.AUTH_TOKEN_MISSING],
      code: ERROR_CODES.AUTH_TOKEN_MISSING,
    });
  }

  try {
    // Верифікуємо токен
    const user = await verifyJwt(token, jwtSecret);

    // Перевіряємо blacklist анонімізованих акаунтів (закриває 15-хв вікно JWT)
    if (await isUserDeleted(user.id)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        error: 'Акаунт було видалено',
        canRefresh: false,
      });
    }

    // Додаємо дані користувача до об'єкта запиту
    req.user = user;
    return next(); // Продовжуємо виконання наступного middleware/контролера
  } catch (err) {
    // Розрізняємо прострочений токен (401) від невалідного (403)
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
    // Інші помилки (наприклад, помилка з isUserDeleted)
    logger.error({ err }, '[Auth] Неочікувана помилка при верифікації токена');
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
      code: ERROR_CODES.SERVER_UNAVAILABLE,
      error: ERROR_MESSAGES[ERROR_CODES.SERVER_UNAVAILABLE],
      canRefresh: false,
    });
  }
};

/**
 * Optional authentication middleware
 * Не вимагає токен, але якщо він є і валідний - додає req.user
 * Використовується для публічних ендпоінтів, які можуть працювати з анонімами та авторизованими
 */
const optionalAuthenticateToken = async (req, res, next) => {
  // Спробуємо отримати токен з cookie або заголовка
  let token = req.cookies?.token;
  if (!token) {
    const authHeader = req.headers['authorization'];
    token = authHeader?.split(' ')[1];
  }

  // Якщо токена немає - просто продовжуємо без req.user
  if (!token) {
    return next();
  }

  try {
    // Верифікуємо токен
    const user = await verifyJwt(token, jwtSecret);

    // Перевіряємо blacklist анонімізованих акаунтів
    if (await isUserDeleted(user.id)) {
      return next();
    }

    // Якщо токен валідний - додаємо користувача
    req.user = user;
    return next();
  } catch (err) {
    // При помилці верифікації або перевірки - просто продовжуємо без req.user
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
