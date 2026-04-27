require('dotenv').config();
const { logger } = require('../lib/logger');

/**
 * Централізована конфігурація змінних оточення
 * Перевіряє наявність всіх необхідних змінних при завантаженні модуля
 */

const nodeEnv = process.env.NODE_ENV || 'development';

const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  ...(nodeEnv === 'production' ? ['COOKIE_SECRET', 'CORS_ALLOWED_ORIGINS'] : [])
];
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const parsedHomeActiveMaxAgeHours = Number(process.env.HOME_ACTIVE_MAX_AGE_HOURS);
const homeActiveMaxAgeHours = Number.isFinite(parsedHomeActiveMaxAgeHours) && parsedHomeActiveMaxAgeHours > 0
  ? parsedHomeActiveMaxAgeHours
  : 24;
const parsedHomePlannedToleranceMinutes = Number(process.env.HOME_PLANNED_TOLERANCE_MINUTES);
const homePlannedToleranceMinutes = Number.isFinite(parsedHomePlannedToleranceMinutes)
  && parsedHomePlannedToleranceMinutes > 0
  ? parsedHomePlannedToleranceMinutes
  : 2;

// Перевірка наявності всіх необхідних змінних оточення
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  logger.error('ПОМИЛКА: Відсутні обов\'язкові змінні оточення');
  missingVars.forEach(varName => {
    logger.error({ varName }, 'Відсутня змінна оточення');
  });
  logger.error('Створіть файл .env в директорії server/ з необхідними змінними. Приклад: .env.example');
  process.exit(1);
}


// Перевірка мінімальної довжини JWT_SECRET для безпеки
if (process.env.JWT_SECRET.length < 32) {
  logger.warn('УВАГА: JWT_SECRET занадто короткий (менше 32 символів). Рекомендується мінімум 32 символи.');
}

if (nodeEnv === 'production') {
  const weakJwtSecrets = new Set([
    'your_super_secret_jwt_key_minimum_32_characters_long',
    'changeme',
    'change_me',
    'secret',
    'jwt_secret',
  ]);

  if (process.env.JWT_SECRET.length < 32 || weakJwtSecrets.has(process.env.JWT_SECRET.toLowerCase())) {
    logger.error('ПОМИЛКА: Для production потрібен сильний JWT_SECRET (мінімум 32 символи, не шаблонний).');
    process.exit(1);
  }

  if (!process.env.COOKIE_SECRET) {
    logger.error('ПОМИЛКА: Для production обов\'язково вкажіть COOKIE_SECRET (окремий від JWT_SECRET).');
    process.exit(1);
  }

  if (!process.env.CORS_ALLOWED_ORIGINS) {
    logger.error('ПОМИЛКА: Для production обов\'язково вкажіть CORS_ALLOWED_ORIGINS.');
    process.exit(1);
  }

  const hasLocalOrigin = corsAllowedOrigins.some(origin => {
    try {
      const parsed = new URL(origin);
      return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    } catch {
      return false;
    }
  });

  if (hasLocalOrigin) {
    logger.error('ПОМИЛКА: CORS_ALLOWED_ORIGINS для production не може містити localhost/127.0.0.1/::1.');
    process.exit(1);
  }
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  port: process.env.PORT || 5000,
  nodeEnv,
  // Налаштування для cookies
  cookieSecret: process.env.COOKIE_SECRET || process.env.JWT_SECRET, // Для підпису CSRF токенів
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173', // URL фронтенду для CORS
  // CORS: список дозволених origin через запяту або новий рядок. Якщо не вказано — використовується FRONTEND_URL
  corsAllowedOrigins,
  // Максимальний вік ACTIVE сесії для Home next-relevant (anti-zombie guard)
  homeActiveMaxAgeHours,
  // Вікно запізнення PLANNED сесії для Home next-relevant
  homePlannedToleranceMinutes,
};
