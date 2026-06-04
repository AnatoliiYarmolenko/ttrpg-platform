const { prisma: defaultPrisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');
const defaultNotificationRecipientResolver = require('./notification/notification-recipient-resolver');
const defaultSseService = require('./notification/notification-sse.service');

class NotificationService {
  constructor(deps = {}) {
    this.prisma = deps.prisma || defaultPrisma;
    this.recipientResolver = deps.recipientResolver || defaultNotificationRecipientResolver;
    this.sseService = deps.sseService || defaultSseService;
  }
  /**
    * Створити повідомлення з отримувачами
    * @param {Object} input - Вхідні дані повідомлення
    * @returns {Promise<Object>} Створене повідомлення
   */
  async createNotification(input) {
    const {
      eventKey,
      type,
      severity,
      category,
      title,
      body,
      link,
      metadata,
      dedupeKey,
      aggregationKey,
      expiresAt,
      source,
      recipientIds,
      audience,
      context,
      dedupeWindowMs,
    } = input;

    const resolvedRecipientIds = await this.resolveRecipientIds({
      recipientIds,
      audience,
      context,
    });

    if (resolvedRecipientIds.length === 0) {
      return null;
    }

      // Створюємо повідомлення та отримувачів у транзакції
    const result = await this.prisma.$transaction(async (tx) => {
      const existingNotification = await this._findExistingNotificationForDedupe(tx, {
        dedupeKey,
        dedupeWindowMs,
      });

      if (existingNotification) {
        const attachedRecipientIds = await this._attachRecipients(tx, existingNotification.id, resolvedRecipientIds);
        return {
          notification: existingNotification,
          attachedRecipientIds,
        };
      }

      const notification = await tx.notification.create({
        data: {
          eventKey,
          type,
          severity,
          category,
          title,
          body,
          link,
          metadata: metadata || {},
          dedupeKey,
          aggregationKey,
          expiresAt,
          source,
        },
      });

      const attachedRecipientIds = await this._attachRecipients(tx, notification.id, resolvedRecipientIds);

      // Створюємо події в Outbox для Telegram
      await this._createTelegramOutboxEvents(tx, notification, attachedRecipientIds);

      return {
        notification,
        attachedRecipientIds,
      };
    });

    // Відправляємо підключеним користувачам через SSE (поза транзакцією)
    this.pushToConnectedUsers(result.notification, result.attachedRecipientIds);

    return result.notification;
  }

  async resolveRecipientIds(input = {}) {
    const { recipientIds = [], audience, context = {} } = input;
    const resolvedIds = new Set((recipientIds || []).filter(Boolean));

    let audiences = [];
    if (Array.isArray(audience)) {
      audiences = audience;
    } else if (audience) {
      audiences = [audience];
    }
    for (const audienceKey of audiences) {
      const audienceRecipientIds = await this.recipientResolver.resolve(audienceKey, context);
      audienceRecipientIds.forEach((userId) => {
        if (userId) {
          resolvedIds.add(userId);
        }
      });
    }

    // Виключаємо актора якщо вказано (правило анти-спам)
    if (context.excludeUserId) {
      const excludedId = Number.parseInt(context.excludeUserId, 10);
      resolvedIds.delete(context.excludeUserId);
      if (Number.isInteger(excludedId)) {
        resolvedIds.delete(excludedId);
      }
    }

    return [...resolvedIds];
  }

  async _findExistingNotificationForDedupe(tx, options = {}) {
    const { dedupeKey, dedupeWindowMs } = options;
    if (!dedupeKey) {
      return null;
    }

    const where = { dedupeKey };
    if (Number.isFinite(dedupeWindowMs) && dedupeWindowMs > 0) {
      where.createdAt = {
        gte: new Date(Date.now() - dedupeWindowMs),
      };
    }

    return tx.notification.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async _attachRecipients(tx, notificationId, recipientIds) {
    const uniqueRecipientIds = [...new Set((recipientIds || []).filter(Boolean))];
    if (uniqueRecipientIds.length === 0) {
      return [];
    }

    const existingRecipients = await tx.notificationRecipient.findMany({
      where: {
        notificationId,
        userId: { in: uniqueRecipientIds },
      },
      select: { userId: true },
    });

    const existingRecipientIds = new Set(existingRecipients.map((recipient) => recipient.userId));
    const newRecipientIds = uniqueRecipientIds.filter((userId) => !existingRecipientIds.has(userId));

    if (newRecipientIds.length === 0) {
      return [];
    }

    await tx.notificationRecipient.createMany({
      data: newRecipientIds.map((userId) => ({
        notificationId,
        userId,
        status: 'ACTIVE',
      })),
      skipDuplicates: true,
    });

    return newRecipientIds;
  }

  async _createTelegramOutboxEvents(tx, notification, recipientIds) {
    if (!recipientIds || recipientIds.length === 0) return;

    // Знаходимо користувачів, у яких є telegramChatId
    const users = await tx.user.findMany({
      where: {
        id: { in: recipientIds },
        telegramChatId: { not: null },
      },
      select: {
        id: true,
        telegramChatId: true,
        notificationPreference: {
          select: { enabledChannels: true },
        },
      },
    });

    const outboxPayloads = [];

    for (const user of users) {
      let channels = [];
      if (user.notificationPreference?.enabledChannels) {
        channels = Array.isArray(user.notificationPreference.enabledChannels)
          ? user.notificationPreference.enabledChannels
          : [];
      }
      
      if (channels.includes('TELEGRAM')) {
        outboxPayloads.push({
          notificationId: notification.id,
          type: 'TELEGRAM_NOTIFICATION',
          payload: {
            chatId: user.telegramChatId,
            title: notification.title,
            body: notification.body,
            severity: notification.severity,
            link: notification.link,
          },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 3,
        });
      }
    }

    if (outboxPayloads.length > 0) {
      await tx.outboxEvent.createMany({
        data: outboxPayloads,
      });
    }
  }

  /**
    * Повернути список повідомлень для користувача
    * @param {number} userId - ID користувача
    * @param {Object} options - Параметри запиту
    * @returns {Promise<Object>} Список повідомлень з пагінацією
   */
  async listNotificationsForUser(userId, options = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where = { userId };
    if (status) {
      where.status = status;
    }

    const [recipients, total] = await Promise.all([
      this.prisma.notificationRecipient.findMany({
        where,
        include: {
          notification: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationRecipient.count({ where }),
    ]);

    const notifications = recipients.map((r) => ({
      id: r.notification.id,
      recipientId: r.id,
      eventKey: r.notification.eventKey,
      type: r.notification.type,
      severity: r.notification.severity,
      category: r.notification.category,
      title: r.notification.title,
      body: r.notification.body,
      link: r.notification.link,
      metadata: r.notification.metadata,
      status: r.status,
      readAt: r.readAt,
      archivedAt: r.archivedAt,
      createdAt: r.createdAt,
    }));

    return {
      notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + notifications.length < total,
      },
    };
  }

  /**
    * Отримати кількість непрочитаних повідомлень для користувача
    * @param {number} userId - ID користувача
    * @returns {Promise<number>} Кількість непрочитаних
   */
  async getUnreadCount(userId) {
    return this.prisma.notificationRecipient.count({
      where: {
        userId,
        status: 'ACTIVE',
      },
    });
  }

  /**
    * Позначити повідомлення як прочитане
    * @param {number} userId - ID користувача
    * @param {number} notificationId - ID повідомлення
    * @returns {Promise<Object>} Оновлений запис отримувача
   */
  async markAsRead(userId, notificationId) {
    const recipient = await this.prisma.notificationRecipient.findFirst({
      where: {
        userId,
        notificationId,
      },
    });

    if (!recipient) {
      throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND);
    }

    if (recipient.status === 'ARCHIVED') {
      return recipient;
    }

    const now = new Date();

    return this.prisma.notificationRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'ARCHIVED',
        readAt: recipient.readAt || now,
        archivedAt: recipient.archivedAt || now,
      },
    });
  }

  /**
    * Позначити кілька повідомлень як прочитані
    * @param {number} userId - ID користувача
    * @param {number[]} notificationIds - Масив ID повідомлень
    * @returns {Promise<number>} Кількість оновлених записів
   */
  async markManyAsRead(userId, notificationIds) {
    const recipients = await this.prisma.notificationRecipient.findMany({
      where: {
        userId,
        notificationId: { in: notificationIds },
        status: 'ACTIVE',
      },
    });

    if (recipients.length === 0) {
      return 0;
    }

    const result = await this.prisma.notificationRecipient.updateMany({
      where: {
        id: { in: recipients.map((r) => r.id) },
      },
      data: {
        status: 'ARCHIVED',
        readAt: new Date(),
        archivedAt: new Date(),
      },
    });

    return result.count;
  }

  /**
    * Відправити повідомлення підключеним користувачам через SSE
    * @param {Object} notification - Створене повідомлення
    * @param {number[]} recipientIds - Масив ID користувачів-отримувачів
   */
  pushToConnectedUsers(notification, recipientIds) {
    if (!notification || !recipientIds || recipientIds.length === 0) {
      return;
    }

    const payload = {
      id: notification.id,
      eventKey: notification.eventKey,
      type: notification.type,
      severity: notification.severity,
      category: notification.category,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      metadata: notification.metadata,
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
    };

    this.sseService.pushToUsers(recipientIds, payload);
  }
}

function createNotificationService(deps = {}) {
  return new NotificationService(deps);
}

module.exports = new NotificationService();
module.exports.NotificationService = NotificationService;
module.exports.createNotificationService = createNotificationService;
