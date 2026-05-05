const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');
const notificationRecipientResolver = require('./notification/notification-recipient-resolver');

class NotificationService {
  /**
   * Create a notification with recipients
   * @param {Object} input - Notification input
   * @returns {Promise<Object>} Created notification
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

    // Create notification and recipients in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const existingNotification = await this._findExistingNotificationForDedupe(tx, {
        dedupeKey,
        dedupeWindowMs,
      });

      if (existingNotification) {
        await this._attachRecipients(tx, existingNotification.id, resolvedRecipientIds);
        return existingNotification;
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

      await this._attachRecipients(tx, notification.id, resolvedRecipientIds);

      return notification;
    });

    return result;
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
      const audienceRecipientIds = await notificationRecipientResolver.resolve(audienceKey, context);
      audienceRecipientIds.forEach((userId) => {
        if (userId) {
          resolvedIds.add(userId);
        }
      });
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
      return;
    }

    await tx.notificationRecipient.createMany({
      data: uniqueRecipientIds.map((userId) => ({
        notificationId,
        userId,
        status: 'UNREAD',
      })),
      skipDuplicates: true,
    });
  }

  /**
   * List notifications for a user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Notifications list with pagination
   */
  async listNotificationsForUser(userId, options = {}) {
    const { status, limit = 20, offset = 0 } = options;

    const where = { userId };
    if (status) {
      where.status = status;
    }

    const [recipients, total] = await Promise.all([
      prisma.notificationRecipient.findMany({
        where,
        include: {
          notification: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.notificationRecipient.count({ where }),
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
      createdAt: r.notification.createdAt,
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
   * Get unread count for a user
   * @param {number} userId - User ID
   * @returns {Promise<number>} Unread count
   */
  async getUnreadCount(userId) {
    return prisma.notificationRecipient.count({
      where: {
        userId,
        status: 'UNREAD',
      },
    });
  }

  /**
   * Mark a notification as read
   * @param {number} userId - User ID
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Object>} Updated recipient
   */
  async markAsRead(userId, notificationId) {
    const recipient = await prisma.notificationRecipient.findFirst({
      where: {
        userId,
        notificationId,
      },
    });

    if (!recipient) {
      throw new AppError(ERROR_CODES.NOTIFICATION_NOT_FOUND);
    }

    if (recipient.status === 'READ' || recipient.status === 'ARCHIVED') {
      return recipient;
    }

    return prisma.notificationRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark multiple notifications as read
   * @param {number} userId - User ID
   * @param {number[]} notificationIds - Notification IDs
   * @returns {Promise<number>} Count of updated recipients
   */
  async markManyAsRead(userId, notificationIds) {
    const recipients = await prisma.notificationRecipient.findMany({
      where: {
        userId,
        notificationId: { in: notificationIds },
        status: 'UNREAD',
      },
    });

    if (recipients.length === 0) {
      return 0;
    }

    const result = await prisma.notificationRecipient.updateMany({
      where: {
        id: { in: recipients.map((r) => r.id) },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Archive a notification for a user
   * @param {number} userId - User ID
   * @param {number} notificationId - Notification ID
   * @returns {Promise<Object>} Updated recipient
   */
  async archiveNotification(userId, notificationId) {
    const recipient = await prisma.notificationRecipient.findFirst({
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

    return prisma.notificationRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });
  }
}

module.exports = new NotificationService();
