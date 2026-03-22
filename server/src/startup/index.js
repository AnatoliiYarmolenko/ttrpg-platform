/**
 * Головний модуль для ініціалізації сервера
 * Експортує всі startup модулі
 */

const { initMigrations, runMigrations } = require('./migrations');
const { createCorsMiddleware } = require('./cors');
const { 
  initAllCleanupJobs, 
  initTokenCleanup, 
  initSessionCleanup,
  initRateLimitCleanup,
  stopAllCleanupJobs,
  shutdownCleanupJobs,
} = require('./cleanup');
const { setupStaticFiles } = require('./static');
const { httpLogger } = require('../lib/logger');

module.exports = {
  // Migrations
  initMigrations,
  runMigrations,
  
  // CORS
  createCorsMiddleware,
  httpLogger,
  
  // Cleanup jobs
  initAllCleanupJobs,
  initTokenCleanup,
  initSessionCleanup,
  initRateLimitCleanup,
  stopAllCleanupJobs,
  shutdownCleanupJobs,
  
  // Static files
  setupStaticFiles,
};
