const { Telegraf } = require('telegraf');
const { logger } = require('../lib/logger');
const config = require('../config/config');

class TelegramService {
  bot = null;
  isInitialized = false;

  constructor() {
    if (config.telegramBotToken) {
      this.bot = new Telegraf(config.telegramBotToken);
      this._setupHandlers();
    } else {
      logger.warn('TELEGRAM_BOT_TOKEN не задано. Telegram-бот не буде активовано.');
    }
  }

  /**
   * Налаштування обробників команд
   * @private
   */
  _setupHandlers() {
    this.bot.start(async (ctx) => {
      const payload = ctx.payload;
      const chatId = ctx.chat.id;

      if (!payload) {
        return ctx.reply('Вітаю! Це бот для нотифікацій. Щоб отримувати сповіщення, прив\'яжіть акаунт через налаштування профілю на сайті.');
      }

      try {
        const profileService = require('./profile.service');
        const success = await profileService.linkTelegram(payload, chatId);
        
        if (success) {
          await ctx.reply('Ваш Telegram акаунт успішно прив\'язано! Тепер ви будете отримувати нотифікації сюди.');
        } else {
          await ctx.reply('Посилання недійсне або прострочене. Будь ласка, згенеруйте нове посилання на сайті.');
        }
      } catch (error) {
        logger.error({ err: error, chatId }, 'Помилка при спробі прив\'язки Telegram');
        await ctx.reply('Сталася помилка при спробі прив\'язки акаунту. Спробуйте пізніше.');
      }
    });

    this.bot.command('stop', async (ctx) => {
      const chatId = ctx.chat.id;
      try {
        const profileService = require('./profile.service');
        await profileService.unlinkTelegramByChatId(chatId);
        await ctx.reply('Нотифікації вимкнено. Ваш Telegram акаунт відв\'язано від платформи.');
      } catch (error) {
        logger.error({ err: error, chatId }, 'Помилка при спробі відв\'язки Telegram');
        await ctx.reply('Сталася помилка при спробі відв\'язки акаунту. Спробуйте пізніше.');
      }
    });

    this.bot.on('message', async (ctx) => {
      if (ctx.chat.type !== 'private') return;
      
      await ctx.reply('Цей бот працює лише в режимі відправки нотифікацій з платформи MyTTRPG. Він не розуміє текстових повідомлень.\n\nДля відписки від нотифікацій використовуйте команду /stop');
    });
  }

  /**
   * Повертає webhook callback для підключення до Express
   */
  getWebhookCallback() {
    if (!this.bot) return null;
    return this.bot.webhookCallback(config.telegramWebhookPath);
  }

  /**
   * Запускає бота (Long Polling або Webhook)
   */
  async launch() {
    if (!this.bot) return;

    try {
      if (config.nodeEnv === 'production' && config.telegramWebhookDomain) {
        const url = `${config.telegramWebhookDomain}${config.telegramWebhookPath}`;
        await this.bot.telegram.setWebhook(url);
        logger.info({ url }, 'Telegram бот налаштовано на Webhook');
      } else {
        // Локально запускаємо Long Polling
        await this.bot.telegram.deleteWebhook();
        this.bot.launch();
        logger.info('Telegram бот запущено в режимі Long Polling');
      }
      this.isInitialized = true;
    } catch (error) {
      logger.error({ err: error }, 'Помилка запуску Telegram бота');
    }
  }

  /**
   * Коректно зупиняємо бота
   */
  stop(signal) {
    if (this.bot && this.isInitialized) {
      this.bot.stop(signal);
      logger.info('Telegram бот зупинено');
    }
  }

  /**
   * Відправляє повідомлення користувачу
   * @param {string|number} chatId ID чату
   * @param {Object} payload Об'єкт повідомлення (title, body, severity, link)
   */
  async sendMessage(chatId, payload) {
    if (!this.bot || !this.isInitialized) {
      throw new Error('Telegram bot is not initialized or token is missing');
    }

    try {
      const text = this._formatMessage(payload);
      
      const options = {
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      };

      if (payload.link) {
        const fullLink = payload.link.startsWith('http') ? payload.link : `${config.frontendUrl}${payload.link}`;
        
        if (!this._isLocalUrl(fullLink)) {
          const safeLink = this._escapeHtml(fullLink);
          let buttonText = 'Перейти';
          
          const titleLower = (payload.title || '').toLowerCase();
          if (titleLower.includes('сесі')) {
            buttonText = 'Перейти до сесії';
          } else if (titleLower.includes('кампан')) {
            buttonText = 'Перейти до кампанії';
          } else if (titleLower.includes('баланс') || titleLower.includes('гаман')) {
            buttonText = 'До гаманця';
          }

          options.reply_markup = {
            inline_keyboard: [
              [{ text: buttonText, url: safeLink }]
            ]
          };
        }
      }

      const message = await this.bot.telegram.sendMessage(chatId, text, options);
      return message;
    } catch (error) {
      logger.error({ err: error, chatId }, 'Помилка відправки Telegram повідомлення');
      throw error;
    }
  }

  _isLocalUrl(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.local')
      );
    } catch {
      return true;
    }
  }

  /**
   * Форматує повідомлення у HTML
   * @private
   */
  _formatMessage({ title, body, severity, link }) {
    const safeTitle = this._escapeHtml(title);
    const safeBody = this._escapeHtml(body);
    
    const logoUrl = `${config.frontendUrl}/logo.png`;
    const logoPrefix = this._isLocalUrl(logoUrl) ? '' : `<a href="${logoUrl}">&#8203;</a>`;
    
    let text = `${logoPrefix}<b>${safeTitle}</b>\n`;
    if (safeBody) {
      text += `${safeBody}\n`;
    }
    
    return text;
  }

  _escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}

module.exports = new TelegramService();
module.exports.TelegramService = TelegramService;
