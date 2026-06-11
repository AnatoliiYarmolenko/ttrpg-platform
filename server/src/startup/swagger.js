const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require('node:path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TTRPG Platform API',
      version: '1.0.0',
      description: 'API документація для TTRPG платформи',
    },
    servers: [
      {
        url: '/',
        description: 'Current Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
        csrfAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-csrf-token',
        },
      },
    },
    security: [
      {
        cookieAuth: [],
      },
    ],
    tags: [
      { name: 'System', description: 'Системні роути (health check, base path)' },
      { name: 'Dev', description: 'Тільки для розробки' },
      { name: 'Auth', description: 'Аутентифікація та управління сесіями' },
      { name: 'Profile', description: 'Керування профілем користувача' },
      { name: 'Campaigns', description: 'Керування кампаніями та майстер-даними' },
      { name: 'Sessions', description: 'Управління ігровими сесіями' },
      { name: 'Search', description: 'Глобальний пошук' },
      { name: 'Security', description: 'Безпека облікового запису' },
      { name: 'Chat', description: 'Чат та повідомлення' },
      { name: 'Notifications', description: 'Сповіщення' },
      { name: 'Admin', description: 'Адмін-панель' },
      { name: 'Client Logs', description: 'Логування клієнтських помилок' },
      { name: 'Wallet', description: 'Віртуальний гаманець та фінансові транзакції' },
    ],
  },
  apis: [path.join(__dirname, '../docs/swagger/**/*.yaml')],
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEV_AUTH !== 'true') {
    return;
  }

  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'TTRPG Platform API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        withCredentials: true,
      },
    })
  );
}

module.exports = setupSwagger;
