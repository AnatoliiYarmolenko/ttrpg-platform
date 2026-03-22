const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

/**
 * Singleton Prisma Client
 * Ініціалізується одразу при імпорті модуля (fail-fast).
 * Якщо Prisma не може підключитися - сервер не стартує.
 */

let prisma;

try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  });
  
  logger.info('Prisma Client ініціалізовано');
} catch (error) {
  logger.fatal({ err: error }, 'Критична помилка ініціалізації Prisma Client');
  process.exit(1); // Fail-fast: зупиняємо процес
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma };
