const telegramService = require('../services/telegram.service');
const config = require('../config/config');

async function initTelegramBot(app) {
  // Монтуємо webhook до Express додатку, якщо потрібно
  if (config.nodeEnv === 'production' && config.telegramWebhookDomain) {
    const webhookCallback = telegramService.getWebhookCallback();
    if (webhookCallback) {
      app.use(webhookCallback);
    }
  }

  // Запускаємо бота
  await telegramService.launch();
}

function stopTelegramBot(signal) {
  telegramService.stop(signal);
}

module.exports = {
  initTelegramBot,
  stopTelegramBot,
};
