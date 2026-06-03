/**
 * Express Application Configuration
 * Окремий модуль для налаштування Express app
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const securityRoutes = require('./routes/security.routes');
const adminRoutes = require('./routes/admin.routes');
const campaignRoutes = require('./routes/campaign.routes');
const sessionRoutes = require('./routes/session.routes');
const chatRoutes = require('./routes/chat.routes');
const searchRoutes = require('./routes/search.routes');
const clientLogsRoutes = require('./routes/client-logs.routes');
const notificationRoutes = require('./routes/notification.routes');

const { errorHandler } = require('./middlewares/error.middleware');
const { addCorrelationId } = require('./middlewares/correlation.middleware');

// Startup modules
const { createCorsMiddleware, setupStaticFiles, httpLogger } = require('./startup');
const { getRedisHealthState } = require('./lib/redis');

function resolveTrustProxySetting() {
  const raw = process.env.TRUST_PROXY;

  if (raw === undefined) {
    return { value: false };
  }

  if (raw === 'true') {
    return { value: true };
  }

  if (raw === 'false') {
    return { value: false };
  }

  if (/^\d+$/.test(raw)) {
    return { value: Number(raw) };
  }

  return { value: raw };
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
    app.use(`${prefix}/chats`, chatRoutes);
    app.use(`${prefix}/search`, searchRoutes);
    app.use(`${prefix}/client-logs`, clientLogsRoutes);
    app.use(`${prefix}/notifications`, notificationRoutes);

    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_DEV_AUTH === 'true') {
      const devRoutes = require('./routes/dev.routes');
      app.use(`${prefix}/dev`, devRoutes);
    }
  };

  app.use(createCorsMiddleware());

  app.use(addCorrelationId);

  app.use(httpLogger);

  app.use(helmet({ crossOriginResourcePolicy: false }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  setupStaticFiles(app);

  const trustProxySetting = resolveTrustProxySetting();
  app.set('trust proxy', trustProxySetting.value);

  // ========== ROUTES ==========

  app.get('/', (req, res) => {
    res.send('Сервер працює! Готовий до НРІ.');
  });

  app.get('/health', (req, res) => {
    const redisHealth = getRedisHealthState();
    const isHealthy = redisHealth.isReady;

    res.status(isHealthy ? 200 : 503).json({ 
      status: isHealthy ? 'ok' : 'degraded', 
      timestamp: new Date().toISOString(),
      redis: redisHealth,
    });
  });

  registerApiRoutes('/api');

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
