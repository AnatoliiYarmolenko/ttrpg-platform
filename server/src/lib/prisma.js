const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

/**
 * Singleton Prisma Client
 * Ініціалізується одразу при імпорті модуля (fail-fast).
 * Якщо Prisma не може підключитися - сервер не стартує.
 */

let prisma;
const isNodeTestRunner = typeof process.env.NODE_TEST_CONTEXT === 'string';

function createPrismaTestStub(initError) {
  const throwInitError = async () => {
    throw initError;
  };

  return {
    campaign: {
      findUnique: throwInitError,
      findMany: throwInitError,
      count: throwInitError,
      update: throwInitError,
    },
    session: {
      findUnique: throwInitError,
      findMany: throwInitError,
      count: throwInitError,
      update: throwInitError,
      updateMany: throwInitError,
    },
    user: {
      findUnique: throwInitError,
      findFirst: throwInitError,
      update: throwInitError,
    },
    $transaction: throwInitError,
    $disconnect: async () => {},
  };
}

try {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
  });
  
  logger.info('Prisma Client ініціалізовано');
} catch (error) {
  logger.fatal({ err: error }, 'Критична помилка ініціалізації Prisma Client');

  if (isNodeTestRunner) {
    prisma = createPrismaTestStub(error);
    logger.warn('Prisma Client не ініціалізовано в test runner, використовуємо test stub');
  } else {
    process.exit(1); // Fail-fast: зупиняємо процес
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma };
