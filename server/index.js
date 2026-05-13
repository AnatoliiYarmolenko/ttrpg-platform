/**
 * Server Entry Point
 * Відповідає тільки за запуск сервера та graceful shutdown
 */

// Завантажуємо конфігурацію (перевіряє змінні оточення)
require('./src/config/config');

const { prisma } = require('./src/lib/prisma');
const { redis, waitForRedisReady } = require('./src/lib/redis');
const { logger } = require('./src/lib/logger');
const { port, wsChatPath } = require('./src/config/config');
const { createApp } = require('./src/app');
const { createWsServer } = require('./src/ws/ws-server');
const { createRoomManager } = require('./src/ws/ws-room.manager');
const { createChatHandler } = require('./src/ws/ws-chat.handler');

// Startup modules
const {
  initMigrations,
  initAllCleanupJobs,
  shutdownCleanupJobs,
} = require('./src/startup');

let server = null;
let wsServer = null;
let roomManager = null;

// ========== GRACEFUL SHUTDOWN ==========
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Graceful shutdown вже виконується');
    return;
  }

  isShuttingDown = true;
  logger.warn({ signal }, 'Отримано сигнал завершення. Завершуємо роботу');
  
  // Зупиняємо прийом нових з'єднань
  if (!server) {
    await shutdownCleanupJobs();
    await prisma.$disconnect();
    process.exit(1);
    return;
  }

  server.close(async () => {
    logger.info('HTTP сервер закрито');

    if (wsServer) {
      await wsServer.close();
    }
    
    // Очищаємо ресурси
    await shutdownCleanupJobs();
    if (redis.status !== 'end' && redis.status !== 'wait') {
      try {
        await redis.quit();
      } catch (err) {
        logger.warn({ err }, 'Не вдалося коректно закрити Redis');
      }
    }
    await prisma.$disconnect();
    
    logger.info('Graceful shutdown завершено');
    process.exit(0);
  });
  
  // Якщо shutdown займає більше 10 секунд - примусово завершуємо
  setTimeout(() => {
    logger.error('Примусове завершення через timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'UNHANDLED_REJECTION');
  gracefulShutdown('UNHANDLED_REJECTION');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'UNCAUGHT_EXCEPTION');
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

async function startServer() {
  // Спочатку чекаємо БД та завершуємо міграції.
  await initMigrations();

  // Потім чекаємо готовність Redis, щоб auth/rate-limit не стартували у деградації.
  await waitForRedisReady();

  // Ініціалізуємо cleanup jobs (токени та rate limits)
  initAllCleanupJobs();

  // ========== CREATE APP ==========
  const app = createApp();

  // ========== START SERVER ==========
  server = app.listen(port, () => {
    logger.info({ port }, 'Сервер запущено');
  });

  roomManager = createRoomManager();
  const chatHandler = createChatHandler({ roomManager, logger });

  wsServer = createWsServer({
    server,
    path: wsChatPath,
    logger,
    onConnection: chatHandler,
  });
  logger.info({ path: wsChatPath }, 'WS сервер запущено');
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Критична помилка старту сервера');
  process.exit(1);
});