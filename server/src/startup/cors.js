/**
 * Модуль налаштування CORS для роботи з cookies
 */

const cors = require('cors');
const { corsAllowedOrigins, nodeEnv } = require('../config/config');

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

/**
 * Створює налаштування CORS middleware
 * @returns {Function} - CORS middleware
 */
function createCorsMiddleware() {
  return cors({
    origin: function (origin, callback) {
      // Дозволяємо запити без origin (наприклад, Postman or curl) та з whitelist
      if (!origin) return callback(null, true);

      if (isDevLocalhostOrigin(origin)) {
        return callback(null, true);
      }

      if (isAllowedConfiguredOrigin(origin)) {
        return callback(null, true);
      }

      console.warn('Blocked CORS origin:', origin);
      return callback(new Error('Не дозволено CORS'));
    },
    credentials: true, // Дозволяємо відправку cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-CSRF-Token', 
      'X-XSRF-Token',
      'Cache-Control',
      'Pragma',
      'Expires'
    ],
    exposedHeaders: ['X-CSRF-Token'],
  });
}

module.exports = {
  createCorsMiddleware,
};
