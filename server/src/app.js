/**
 * Express Application Configuration
 * Окремий модуль для налаштування Express app
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

// Routes
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const securityRoutes = require('./routes/security.routes');
const adminRoutes = require('./routes/admin.routes');
const campaignRoutes = require('./routes/campaign.routes');
const sessionRoutes = require('./routes/session.routes');
const searchRoutes = require('./routes/search.routes');
const clientLogsRoutes = require('./routes/clientLogs.routes');

// Middlewares
const { errorHandler } = require('./middlewares/error.middleware');

// Startup modules
const { createCorsMiddleware, setupStaticFiles, httpLogger } = require('./startup');

function resolveTrustProxySetting() {
  const raw = process.env.TRUST_PROXY;

  if (raw === undefined) {
    return false;
  }

  if (raw === 'true') {
    return true;
  }

  if (raw === 'false') {
    return false;
  }

  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }

  return raw;
}

/**
 * Створює та налаштовує Express application
 * @returns {Express} Налаштований Express app
 */
function createApp() {
  const app = express();
  const registerApiRoutes = (prefix) => {
    app.use(`${prefix}/auth`, authRoutes);
    app.use(`${prefix}/profile`, profileRoutes);
    app.use(`${prefix}/security`, securityRoutes);
    app.use(`${prefix}/admin`, adminRoutes);
    app.use(`${prefix}/campaigns`, campaignRoutes);
    app.use(`${prefix}/sessions`, sessionRoutes);
    app.use(`${prefix}/search`, searchRoutes);
    app.use(`${prefix}/client-logs`, clientLogsRoutes);
  };

  // ========== MIDDLEWARE ==========

  // Налаштування CORS для роботи з cookies
  app.use(createCorsMiddleware());

  // Структуроване логування HTTP запитів (reqId, statusCode, responseTime)
  app.use(httpLogger);

  // Базові security headers.
  // CORP вимикаємо, щоб не ламати завантаження аватарів з окремого фронтенд origin.
  app.use(helmet({ crossOriginResourcePolicy: false }));

  // Парсери
  app.use(express.json({ limit: '10mb' })); // JSON з підтримкою UTF-8
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Для форм
  app.use(cookieParser()); // Парсер для cookies

  // Статична папка для завантажених файлів (аватари тощо)
  setupStaticFiles(app);

  // Налаштування для отримання правильного IP адреси (для rate limiting)
  // Важливо для роботи за proxy/load balancer
  app.set('trust proxy', resolveTrustProxySetting());

  // ========== ROUTES ==========

  // Health check / Root endpoint
  app.get('/', (req, res) => {
    res.send('Сервер працює! Готовий до НРІ.');
  });

  // Health check endpoint для Docker/Kubernetes
  app.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    });
  });

  // API Routes (v1 + legacy aliases)
  registerApiRoutes('/api/v1');
  registerApiRoutes('/api');

  // ========== ERROR HANDLER ==========
  // Повинен бути останнім middleware
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
