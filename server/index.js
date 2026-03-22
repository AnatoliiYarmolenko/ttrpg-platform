/**
 * Server Entry Point
 * Відповідає тільки за запуск сервера та graceful shutdown
 */

// Завантажуємо конфігурацію (перевіряє змінні оточення)
require('./src/config/config');

const { prisma } = require('./src/lib/prisma');
const { redis } = require('./src/lib/redis');
const { port } = require('./src/config/config');
const { createApp } = require('./src/app');

// Startup modules
const {
  initMigrations,
  initAllCleanupJobs,
  shutdownCleanupJobs,
} = require('./src/startup');

// ========== ІНІЦІАЛІЗАЦІЯ ПРИ СТАРТІ ==========

// Виконуємо міграції при старті
initMigrations();

// Підключаємось до Redis (lazyConnect=true — потрібне явне підключення)
redis.connect().catch((err) => {
  // Некритична помилка: сервер запуститься без Redis,
  // але blacklist і rate-limit будуть тимчасово недоступні
  console.error('⚠️ Redis недоступний при старті:', err.message);
});

// Ініціалізуємо cleanup jobs (токени та rate limits)
initAllCleanupJobs();

// ========== CREATE APP ==========
const app = createApp();

// ========== START SERVER ==========
const server = app.listen(port, () => {
  console.log(`✅ Сервер запущено на порту ${port}`);
});

// ========== GRACEFUL SHUTDOWN ==========
async function gracefulShutdown(signal) {
  console.log(`\n🛑 ${signal} отримано. Завершуємо роботу...`);
  
  // Зупиняємо прийом нових з'єднань
  server.close(async () => {
    console.log('📡 HTTP сервер закрито');
    
    // Очищаємо ресурси
    await shutdownCleanupJobs();
    if (redis.status !== 'end' && redis.status !== 'wait') {
      try {
        await redis.quit();
      } catch (err) {
        console.warn('⚠️ Не вдалося коректно закрити Redis:', err.message);
      }
    }
    await prisma.$disconnect();
    
    console.log('✅ Graceful shutdown завершено');
    process.exit(0);
  });
  
  // Якщо shutdown займає більше 10 секунд - примусово завершуємо
  setTimeout(() => {
    console.error('⚠️ Примусове завершення через timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));