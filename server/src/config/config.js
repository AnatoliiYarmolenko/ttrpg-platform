require('dotenv').config();

/**
 * Централізована конфігурація змінних оточення
 * Перевіряє наявність всіх необхідних змінних при завантаженні модуля
 */

const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
];

const nodeEnv = process.env.NODE_ENV || 'development';
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Перевірка наявності всіх необхідних змінних оточення
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ ПОМИЛКА: Відсутні обов\'язкові змінні оточення:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\n💡 Створіть файл .env в директорії server/ з необхідними змінними.');
  console.error('   Приклад: дивіться .env.example\n');
  process.exit(1);
}


// Перевірка мінімальної довжини JWT_SECRET для безпеки
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  УВАГА: JWT_SECRET занадто короткий (менше 32 символів). Рекомендується використовувати мінімум 32 символи для безпеки.');
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
    console.error('❌ ПОМИЛКА: Для production потрібен сильний JWT_SECRET (мінімум 32 символи, не шаблонний).');
    process.exit(1);
  }

  if (!process.env.COOKIE_SECRET) {
    console.error('❌ ПОМИЛКА: Для production обов\'язково вкажіть COOKIE_SECRET (окремий від JWT_SECRET).');
    process.exit(1);
  }

  if (!process.env.CORS_ALLOWED_ORIGINS) {
    console.error('❌ ПОМИЛКА: Для production обов\'язково вкажіть CORS_ALLOWED_ORIGINS.');
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
    console.error('❌ ПОМИЛКА: CORS_ALLOWED_ORIGINS для production не може містити localhost/127.0.0.1/::1.');
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
};
