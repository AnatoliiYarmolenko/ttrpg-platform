/**
 * Модуль для виконання міграцій Prisma при старті сервера
 */

const { execSync } = require('child_process');
const path = require('path');

/**
 * Виконує міграції Prisma
 * @returns {Promise<boolean>} - true якщо міграції виконано успішно
 */
async function runMigrations() {
  try {
    console.log('Виконуємо міграції Prisma...');
    const rootDir = path.resolve(__dirname, '../..');
    execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: rootDir });
    console.log('Міграції виконано успішно');
    return true;
  } catch (error) {
    console.warn('Помилка виконання міграцій:', error.message);
    // Не зупиняємо сервер, якщо міграції не виконалися
    return false;
  }
}

/**
 * Ініціалізує міграції при старті сервера
 * Виконується в Docker або якщо встановлено змінну оточення
 * В development можна вимкнути через RUN_MIGRATIONS=false
 */
async function initMigrations() {
  if (process.env.RUN_MIGRATIONS !== 'false') {
    try {
      await runMigrations();
    } catch (err) {
      console.error('Критична помилка при виконанні міграцій:', err);
    }
  }
}

module.exports = {
  runMigrations,
  initMigrations,
};
