const path = require('node:path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../../.env'),
});
const { logger } = require('../lib/logger');

/**
 * Централізована конфігурація змінних оточення
 * Перевіряє наявність всіх необхідних змінних при завантаженні модуля
 */

const nodeEnv = process.env.NODE_ENV || 'development';

const requiredEnvVars = [
  'JWT_SECRET',
  'DATABASE_URL',
  'SHARE_TOKEN_SECRET',
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
  logger.error('Створіть кореневий файл .env з необхідними змінними. Приклад: .env.example');
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

// ========== mediasoup port range ==========
const parsedMinPort = Number(process.env.MEDIASOUP_MIN_PORT);
const mediasoupMinPort = Number.isInteger(parsedMinPort) && parsedMinPort > 0 ? parsedMinPort : 40000;
const parsedMaxPort = Number(process.env.MEDIASOUP_MAX_PORT);
const mediasoupMaxPort = Number.isInteger(parsedMaxPort) && parsedMaxPort > mediasoupMinPort ? parsedMaxPort : 49999;

// ========== WebRTC & TURN Validation ==========
const mediasoupListenIp = process.env.MEDIASOUP_LISTEN_IP || '0.0.0.0';
const mediasoupAnnouncedIp = (process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1').trim();
const turnEnabled = process.env.TURN_ENABLED === 'true';
const turnUrl = (process.env.TURN_URL || '').trim();
const turnSharedSecret = (process.env.TURN_SHARED_SECRET || '').trim();
const turnRealm = (process.env.TURN_REALM || '').trim();
const parsedTurnCredentialTtlSeconds = Number(process.env.TURN_CREDENTIAL_TTL_SECONDS);
const turnCredentialTtlSeconds = Number.isInteger(parsedTurnCredentialTtlSeconds)
  && parsedTurnCredentialTtlSeconds > 0
  ? parsedTurnCredentialTtlSeconds
  : 3600;
const turnTransport = process.env.TURN_TRANSPORT || 'udp';

// Валідація анонсованого IP для WebRTC
const isLoopbackIp = (ip) => ['127.0.0.1', 'localhost', '::1', '0.0.0.0'].includes(ip.toLowerCase());

if (nodeEnv === 'production') {
  if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
    logger.error('ПОМИЛКА: Для production обов\'язково вкажіть MEDIASOUP_ANNOUNCED_IP (публічний IP сервера).');
    process.exit(1);
  }
  if (isLoopbackIp(mediasoupAnnouncedIp)) {
    logger.error(`ПОМИЛКА: MEDIASOUP_ANNOUNCED_IP (${mediasoupAnnouncedIp}) не може бути loopback/local IP у production.`);
    process.exit(1);
  }
}
if (nodeEnv !== 'production' && !process.env.MEDIASOUP_ANNOUNCED_IP) {
  logger.warn('УВАГА: MEDIASOUP_ANNOUNCED_IP не вказано. Використовується дефолтний 127.0.0.1 для локальної розробки.');
}

// Валідація TURN налаштувань, якщо TURN увімкнено
if (turnEnabled) {
  if (!turnUrl) {
    logger.error('ПОМИЛКА: TURN_ENABLED=true, але TURN_URL не вказано.');
    process.exit(1);
  }
  if (!turnUrl.startsWith('turn:') && !turnUrl.startsWith('turns:')) {
    logger.error(`ПОМИЛКА: Невалідний формат TURN_URL (${turnUrl}). URL має починатися з 'turn:' або 'turns:'.`);
    process.exit(1);
  }
  if (!turnSharedSecret) {
    logger.error('ПОМИЛКА: TURN_ENABLED=true, але TURN_SHARED_SECRET не вказано.');
    process.exit(1);
  }
  if (!turnRealm) {
    logger.error('ПОМИЛКА: TURN_ENABLED=true, але TURN_REALM не вказано.');
    process.exit(1);
  }
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  port: process.env.PORT || 5000,
  wsChatPath: process.env.WS_CHAT_PATH || '/ws/chat',
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

  // Шлях для окремого WebSocket-з'єднання дзвінків
  wsCallPath: process.env.WS_CALL_PATH || '/ws/call',

  // IP, на якому mediasoup worker слухає WebRTC транспорти
  // У Docker/production — 0.0.0.0; локально — 127.0.0.1
  mediasoupListenIp,
  // Зовнішній IP, який mediasoup оголошує клієнтам у ICE candidates
  // ОБОВ'ЯЗКОВО змінити на реальний IP сервера у production
  mediasoupAnnouncedIp,
  // Діапазон UDP портів для RTC транспортів (потрібно відкрити на firewall)
  mediasoupMinPort,
  mediasoupMaxPort,

  // Вмикає/вимикає TURN у ICE конфігурації клієнта
  // false — безпечний дефолт для локальної розробки (між вкладками одного браузера TURN не потрібен)
  turnEnabled,
  // TURN сервер URL (формат: turn:host:port або turns:host:port?transport=tcp)
  turnUrl,
  // Shared secret для time-limited TURN credentials (coturn use-auth-secret)
  turnSharedSecret,
  // Realm для TURN credentials generation
  turnRealm,
  // Час життя тимчасових TURN credentials
  turnCredentialTtlSeconds,
  // Транспортний протокол TURN: 'udp' | 'tcp'
  turnTransport,

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramWebhookDomain: process.env.TELEGRAM_WEBHOOK_DOMAIN || process.env.FRONTEND_URL,
  telegramWebhookPath: process.env.TELEGRAM_WEBHOOK_PATH || '/telegram/webhook',
};
