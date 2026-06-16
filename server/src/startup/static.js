/**
 * Модуль для налаштування статичних файлів
 */

const express = require('express');
const path = require('node:path');
const { logger } = require('../lib/logger');

/**
 * Налаштовує статичні файли для Express додатку
 * @param {Express} app - Express додаток
 * @param {Object} options - Опції налаштування
 * @param {string} options.uploadsPath - Шлях до папки uploads (за замовчуванням: 'uploads')
 * @param {string} options.uploadsRoute - URL маршрут для uploads (за замовчуванням: '/uploads')
 */
function setupStaticFiles(app, options = {}) {
  const {
    uploadsPath = 'uploads',
    uploadsRoute = '/uploads',
  } = options;

  // Визначаємо абсолютний шлях до папки uploads
  const rootDir = path.resolve(__dirname, '../..');
  const absoluteUploadsPath = path.isAbsolute(uploadsPath) 
    ? uploadsPath 
    : path.join(rootDir, uploadsPath);

  // Статична папка для завантажених файлів (аватари тощо)
  app.use(uploadsRoute, express.static(absoluteUploadsPath));
  
  // Додаємо аліас /api/uploads для сумісності з Nginx (який зазвичай проксіює лише /api)
  if (!uploadsRoute.startsWith('/api/')) {
    app.use(`/api${uploadsRoute}`, express.static(absoluteUploadsPath));
  }

  logger.info({ uploadsRoute, absoluteUploadsPath }, 'Статичні файли налаштовано');
}

module.exports = {
  setupStaticFiles,
};
