const { execSync } = require('node:child_process');
const path = require('node:path');
const { Client } = require('pg');
const { logger } = require('../lib/logger');

const DEFAULT_DB_WAIT_ATTEMPTS = Number(process.env.DB_READY_MAX_ATTEMPTS || 30);
const DEFAULT_DB_WAIT_DELAY_MS = Number(process.env.DB_READY_DELAY_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingDatabase() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end().catch(() => {});
  }
}

async function waitForDatabaseReady(options = {}) {
  const maxAttempts = options.maxAttempts || DEFAULT_DB_WAIT_ATTEMPTS;
  const delayMs = options.delayMs || DEFAULT_DB_WAIT_DELAY_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pingDatabase();
      logger.info({ attempt }, 'База даних готова до роботи');
      return true;
    } catch (err) {
      const isLastAttempt = attempt === maxAttempts;
      logger.warn(
        { attempt, maxAttempts, delayMs, err },
        'База даних ще не готова, очікуємо повторну спробу'
      );

      if (isLastAttempt) {
        throw err;
      }

      await sleep(delayMs);
    }
  }

  return false;
}

/**
 * Виконує міграції Prisma
 * @returns {Promise<boolean>} - true якщо міграції виконано успішно
 */
async function runMigrations() {
  try {
    logger.info('Виконуємо міграції Prisma');
    const prismaDir = path.resolve(__dirname, '../..');
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit', 
      cwd: prismaDir, 
      env: { ...process.env }
    });
    logger.info('Міграції виконано успішно');
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Помилка виконання міграцій');
    throw error;
  }
}

async function initMigrations() {
  await waitForDatabaseReady();

  if (process.env.RUN_MIGRATIONS === 'false') {
    logger.warn('RUN_MIGRATIONS=false: міграції пропущено');
    return true;
  }

  await runMigrations();
  return true;
}

module.exports = {
  runMigrations,
  initMigrations,
  waitForDatabaseReady,
};
