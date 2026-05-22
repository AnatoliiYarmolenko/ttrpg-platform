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
  const numWorkers = Object.keys(os.cpus()).length || 1;
  logger.info({ numWorkers }, 'Ініціалізація mediasoup workers...');

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      ...workerSettings,
    });

    worker.on('died', () => {
      // Worker падає дуже рідко (C++ crash).
      // Всі його routers/transports/producers будуть закриті, 
      // тому ми логуємо fatal і завершуємо процес (PM2 або Docker його перезапустять).
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
}

module.exports = {
  initWorkers,
  getWorker,
  closeWorkers,
};
