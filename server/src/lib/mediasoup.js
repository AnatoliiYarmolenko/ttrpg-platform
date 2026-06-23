const os = require('node:os');
const mediasoup = require('mediasoup');
const { logger } = require('./logger');
const { workerSettings } = require('../config/mediasoup.config');

const workers = [];
let nextWorkerIndex = 0;

/**
 * Ініціалізація mediasoup workers.
 * Створюємо по одному worker на кожне логічне ядро CPU.
 */
async function initWorkers() {
  if (workers.length > 0) {
    logger.warn('Mediasoup workers вже ініціалізовані');
    return;
  }

  const envWorkers = process.env.MEDIASOUP_NUM_WORKERS
    ? parseInt(process.env.MEDIASOUP_NUM_WORKERS, 10)
    : 0;
  const numWorkers = envWorkers > 0 ? envWorkers : (Object.keys(os.cpus()).length || 1);
  logger.info({ numWorkers }, 'Ініціалізація mediasoup workers...');

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      ...workerSettings,
    });

    worker.on('died', () => {
      logger.fatal(
        `Mediasoup worker died [pid:${worker.pid}], exiting in 2 seconds...`
      );
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }

  logger.info(`Створено ${workers.length} mediasoup workers`);
}

/**
 * Отримати наступного доступного worker для створення Router (кімнати).
 * Використовує Round-Robin для розподілу навантаження.
 * 
 * @returns {import('mediasoup/node/lib/Worker').Worker}
 */
function getWorker() {
  if (workers.length === 0) {
    throw new Error('Mediasoup workers не ініціалізовані');
  }

  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
  
  return worker;
}

/**
 * Коректно закрити всі workers під час shutdown сервера.
 */
function closeWorkers() {
  logger.info('Закриття mediasoup workers...');
  for (const worker of workers) {
    worker.close();
  }
  workers.length = 0;
  nextWorkerIndex = 0;
}

module.exports = {
  initWorkers,
  getWorker,
  closeWorkers,
};
