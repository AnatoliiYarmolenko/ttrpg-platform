/**
 * Server Entry Point
 * Відповідає тільки за запуск сервера та graceful shutdown
 */

require('./src/config/config');

const { prisma } = require('./src/lib/prisma');
const { redis, waitForRedisReady } = require('./src/lib/redis');
const { logger } = require('./src/lib/logger');
const { port, wsChatPath, wsCallPath } = require('./src/config/config');
const { createApp } = require('./src/app');
const { createWsServer } = require('./src/ws/ws-server');
const { createRoomManager } = require('./src/ws/ws-room.manager');
const { createMainWsHandler } = require('./src/ws/ws-router');
const { createCallHandler } = require('./src/ws/ws-call.handler');
const { initWorkers, closeWorkers } = require('./src/lib/mediasoup');

const {
  initMigrations,
  initAllCleanupJobs,
  shutdownCleanupJobs,
  initTelegramBot,
  stopTelegramBot,
} = require('./src/startup');

const notificationSSEService = require('./src/services/notification/notification-sse.service');

let server = null;
let wsServer = null;
let wsCallServer = null;
let roomManager = null;

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
    stopTelegramBot(signal);
    closeWorkers();
    notificationSSEService.shutdown();
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
    if (wsCallServer) {
      await wsCallServer.close();
    }
    
    // Очищаємо ресурси
    stopTelegramBot(signal);
    closeWorkers();
    notificationSSEService.shutdown();
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
  
  setTimeout(() => {
    logger.error('Примусове завершення через timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Для nodemon
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

  // Ініціалізуємо mediasoup workers
  await initWorkers();

  // Ініціалізуємо cleanup jobs (токени та rate limits)
  initAllCleanupJobs();

  const app = createApp();

  // Ініціалізуємо Telegram бота
  await initTelegramBot(app);

  server = app.listen(port, () => {
    logger.info({ port }, 'Сервер запущено');
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`Swagger UI доступний за адресою: http://localhost:${port}/api-docs`);
    }
  });

  roomManager = createRoomManager();
  const mainWsHandler = createMainWsHandler({ roomManager, logger });

  wsServer = createWsServer({
    server,
    path: wsChatPath,
    logger,
    onConnection: mainWsHandler,
  });
  logger.info({ path: wsChatPath }, 'WS сервер запущено (Chat)');

  const callHandler = createCallHandler({ logger });
  wsCallServer = createWsServer({
    server,
    path: wsCallPath,
    logger,
    onConnection: callHandler,
  });
  logger.info({ path: wsCallPath }, 'WS сервер запущено (Call)');
}

startServer().catch((err) => {
  logger.fatal({ err }, 'Критична помилка старту сервера');
  process.exit(1);
});