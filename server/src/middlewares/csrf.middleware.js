const crypto = require('crypto');
const { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } = require('../constants/errors');
const { COOKIE_NAMES } = require('../utils/cookie.helper');

/**
 * CSRF Protection Middleware (Double-Submit Cookie Pattern)
 * Генерує CSRF токен та перевіряє його при POST/PUT/DELETE/PATCH запитах
 */

const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000;
const CSRF_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: CSRF_COOKIE_MAX_AGE,
  path: '/',
};

// Генеруємо CSRF токен
const generateCSRFToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

const setCSRFTokenCookie = (res, token) => {
  res.cookie(COOKIE_NAMES.XSRF_TOKEN, token, CSRF_COOKIE_OPTIONS);
  res.setHeader('X-CSRF-Token', token);
};

const rejectCSRFRequest = (res, errorMessage = ERROR_MESSAGES[ERROR_CODES.SECURITY_CSRF_INVALID]) => {
  return res.status(HTTP_STATUS.FORBIDDEN).json({
    code: ERROR_CODES.SECURITY_CSRF_INVALID,
    error: errorMessage,
  });
};

const isBearerOnlyRequest = (req) => {
  const hasAuthorizationHeader = typeof req.headers['authorization'] === 'string' && req.headers['authorization'].trim().length > 0;
  const hasAuthCookies = Boolean(req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] || req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN]);

  return hasAuthorizationHeader && !hasAuthCookies;
};

// Middleware для встановлення CSRF токена в cookie та повернення його в заголовку
const setCSRFToken = (req, res, next) => {
  // Перевіряємо, чи вже є CSRF токен в cookie
  const existingToken = req.cookies?.[COOKIE_NAMES.XSRF_TOKEN];
  
  // Якщо токен вже є, використовуємо його, інакше генеруємо новий
  const csrfToken = existingToken || generateCSRFToken();
  
  setCSRFTokenCookie(res, csrfToken);
  
  next();
};

// Middleware для перевірки CSRF токена
const verifyCSRFToken = (req, res, next) => {
  // Перевіряємо тільки для небезпечних методів
  const unsafeMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  
  if (!unsafeMethods.includes(req.method)) {
    return next(); // Пропускаємо безпечні методи
  }

  if (isBearerOnlyRequest(req)) {
    return next();
  }

  // Отримуємо CSRF токен з cookie
  const cookieToken = req.cookies?.[COOKIE_NAMES.XSRF_TOKEN];
  
  // Отримуємо CSRF токен з заголовка (перевіряємо різні варіанти назв)
  const headerToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'] || req.headers['X-CSRF-Token'];

  // Якщо cookie немає, видаємо новий токен, але не пропускаємо unsafe-запит без перевірки.
  if (!cookieToken) {
    setCSRFTokenCookie(res, generateCSRFToken());
    return rejectCSRFRequest(res, 'CSRF токен відсутній. Оновіть сторінку та повторіть запит.');
  }

  // Перевіряємо наявність заголовка
  if (!headerToken) {
    return rejectCSRFRequest(res, 'CSRF токен не надано в заголовку');
  }

  // Перевіряємо, чи токени співпадають
  if (cookieToken !== headerToken) {
    return rejectCSRFRequest(res);
  }

  next();
};

module.exports = {
  setCSRFToken,
  verifyCSRFToken,
};
