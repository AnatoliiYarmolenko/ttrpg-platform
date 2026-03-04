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

module.exports = {
  // Migrations
  initMigrations,
  runMigrations,
  
  // CORS
  createCorsMiddleware,
  
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
