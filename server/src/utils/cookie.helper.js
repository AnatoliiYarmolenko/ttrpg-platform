/**
 * Cookie Helper
 * Централізоване управління cookie опціями та операціями
 */

const { nodeEnv } = require('../config/config');
const { TOKEN_TTL_MS } = require('../config/tokens.config');

// Визначаємо, чи ми в production
const isProduction = nodeEnv === 'production';

// ===== КОНФІГУРАЦІЯ =====

/**
 * Базові опції для cookies
 */
const BASE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  path: '/',
};

/**
 * Час життя токенів (в мілісекундах)
 */
const TOKEN_EXPIRY = {
  ACCESS_TOKEN: TOKEN_TTL_MS.ACCESS_TOKEN,
  REFRESH_TOKEN: TOKEN_TTL_MS.REFRESH_TOKEN,
};

/**
 * Назви cookies
 */
const COOKIE_NAMES = {
  ACCESS_TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  XSRF_TOKEN: 'XSRF-TOKEN',
};

// ===== ФУНКЦІЇ =====

/**
 * Отримати базові опції для cookies
 * @param {Object} overrides - Перевизначення опцій
 * @returns {Object} Cookie options
 */
function getCookieOptions(overrides = {}) {
  return {
    ...BASE_COOKIE_OPTIONS,
    ...overrides,
  };
}

/**
 * Отримати опції для access token cookie
 * @returns {Object} Cookie options для access token
 */
function getAccessTokenCookieOptions() {
  return getCookieOptions({
    maxAge: TOKEN_EXPIRY.ACCESS_TOKEN,
  });
}

/**
 * Отримати опції для refresh token cookie
 * @returns {Object} Cookie options для refresh token
 */
function getRefreshTokenCookieOptions() {
  return getCookieOptions({
    maxAge: TOKEN_EXPIRY.REFRESH_TOKEN,
  });
}

/**
 * Встановити auth cookies (access + refresh tokens)
 * @param {Response} res - Express response object
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 */
function setAuthCookies(res, accessToken, refreshToken) {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, getAccessTokenCookieOptions());
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, getRefreshTokenCookieOptions());
}

/**
 * Очистити auth cookies (при logout)
 * @param {Response} res - Express response object
 */
function clearAuthCookies(res) {
  const clearOptions = getCookieOptions();
  
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearOptions);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearOptions);
  // XSRF токен не httpOnly, щоб JS міг його читати
  res.clearCookie(COOKIE_NAMES.XSRF_TOKEN, { ...clearOptions, httpOnly: false });
}

/**
 * Отримати refresh token з cookies
 * @param {Request} req - Express request object
 * @returns {string|undefined} Refresh token
 */
function getRefreshTokenFromCookies(req) {
  return req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN];
}

/**
 * Отримати access token з cookies
 * @param {Request} req - Express request object
 * @returns {string|undefined} Access token
 */
function getAccessTokenFromCookies(req) {
  return req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
}

module.exports = {
  // Константи
  COOKIE_NAMES,
  TOKEN_EXPIRY,
  BASE_COOKIE_OPTIONS,
  
  // Функції для отримання опцій
  getCookieOptions,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  
  // Функції для роботи з cookies
  setAuthCookies,
  clearAuthCookies,
  getRefreshTokenFromCookies,
  getAccessTokenFromCookies,
};
