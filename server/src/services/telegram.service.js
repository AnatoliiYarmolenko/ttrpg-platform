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
        // Ліниве завантаження для уникнення циклічних залежностей
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

    // Обробник для всіх інших повідомлень 
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
        // У продакшені ми підключаємо webhook в Express, тут тільки кажемо Телеграму куди слати запити
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
    if (!this.bot || !this.isInitialized) return null;

    try {
      const text = this._formatMessage(payload);
      
      const message = await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
      return message;
    } catch (error) {
      // Викидаємо помилку далі, щоб worker міг її обробити (напр., 403 Forbidden)
      logger.error({ err: error, chatId }, 'Помилка відправки Telegram повідомлення');
      throw error;
    }
  }

  /**
   * Форматує повідомлення у HTML
   * @private
   */
  _formatMessage({ title, body, severity, link }) {
    const emoji = this._getSeverityEmoji(severity);
    
    // Екранування HTML символів для безпеки
    const safeTitle = this._escapeHtml(title);
    const safeBody = this._escapeHtml(body);
    
    let text = `${emoji} <b>${safeTitle}</b>\n`;
    if (safeBody) {
      text += `${safeBody}\n`;
    }
    
    if (link) {
      // Якщо посилання відносне, додаємо домен фронтенду
      const fullLink = link.startsWith('http') ? link : `${config.frontendUrl}${link}`;
      text += `\n<a href="${fullLink}">Перейти</a>`;
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

  _getSeverityEmoji(severity) {
    const map = {
      SUCCESS: '✅',
      INFO: 'ℹ️',
      WARNING: '⚠️',
      ERROR: '❌',
      CRITICAL: '🚨',
      SECURITY: '🔐'
    };
    return map[severity?.toUpperCase()] || 'ℹ️';
  }
}

module.exports = new TelegramService();
module.exports.TelegramService = TelegramService;
