const cron = require('node-cron');
const { prisma } = require('../lib/prisma');
const { logger } = require('../lib/logger');
const telegramService = require('./telegram.service');
const profileService = require('./profile.service');

class TelegramOutboxWorker {
  cronJob = null;
  isRunning = false;

  start() {
    if (this.cronJob) return;

    // Запускаємо кожну хвилину
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.processOutbox();
    });

    logger.info('Telegram Outbox Worker запущено');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Telegram Outbox Worker зупинено');
    }
  }

  async processOutbox() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const batchSize = 30; // Беремо партіями, щоб не перевищувати ліміти Telegram (30 msg/sec)
      const now = new Date();

      // Знаходимо PENDING події або завислі PROCESSING
      const events = await prisma.outboxEvent.findMany({
        where: {
          type: 'TELEGRAM_NOTIFICATION',
          OR: [
            { status: 'PENDING' },
            { status: 'PROCESSING', nextRunAt: { lte: now } }
          ]
        },
        take: batchSize,
        orderBy: { createdAt: 'asc' }
      });

      if (events.length === 0) {
        this.isRunning = false;
        return;
      }

      // Позначаємо як PROCESSING
      await prisma.outboxEvent.updateMany({
        where: { id: { in: events.map(e => e.id) } },
        data: {
          status: 'PROCESSING',
          nextRunAt: new Date(now.getTime() + 5 * 60000) // Timeout 5 хвилин на обробку
        }
      });

      for (const event of events) {
        try {
          const payload = event.payload;
          
          await telegramService.sendMessage(payload.chatId, payload);

          await prisma.$transaction([
            prisma.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: 'DONE',
                processedAt: new Date(),
                attempts: event.attempts + 1
              }
            }),
            prisma.deliveryAttempt.create({
              data: {
                outboxId: event.id,
                channel: 'TELEGRAM',
                status: 'SUCCESS'
              }
            })
          ]);

        } catch (error) {
          const errorMessage = error.response?.description || error.message || 'Unknown error';
          const isForbidden = errorMessage.includes('bot was blocked') || error.response?.error_code === 403;

          const newAttempts = event.attempts + 1;
          const isFailed = isForbidden || newAttempts >= event.maxAttempts;

          // Оновлюємо статус в БД
          await prisma.$transaction(async (tx) => {
            await tx.outboxEvent.update({
              where: { id: event.id },
              data: {
                status: isFailed ? 'FAILED' : 'PENDING',
                attempts: newAttempts,
                lastError: errorMessage,
                nextRunAt: isFailed ? event.nextRunAt : new Date(Date.now() + 60000 * newAttempts) // Backoff
              }
            });

            await tx.deliveryAttempt.create({
              data: {
                outboxId: event.id,
                channel: 'TELEGRAM',
                status: 'ERROR',
                error: errorMessage
              }
            });
          });

          // Якщо користувач заблокував бота, відв'язуємо акаунт
          if (isForbidden) {
            logger.warn({ chatId: event.payload.chatId }, 'Бот заблокований користувачем. Відв\'язуємо акаунт.');
            await profileService.unlinkTelegramByChatId(event.payload.chatId);
          }
        }
        
        // Невелика затримка для Rate Limit Telegram API (35мс)
        await new Promise(resolve => setTimeout(resolve, 35));
      }

    } catch (error) {
      logger.error({ err: error }, 'Помилка в Telegram Outbox Worker');
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new TelegramOutboxWorker();
module.exports.TelegramOutboxWorker = TelegramOutboxWorker;
