const notificationService = require('../services/notification.service');

class NotificationController {
  /**
   * Get notifications list for current user
   * GET /api/notifications
   */
  async getNotifications(req, res, next) {
    try {
      const userId = req.user.id;
      const { status, limit, offset } = req.query;

      const result = await notificationService.listNotificationsForUser(userId, {
        status,
        limit: limit ? Number.parseInt(limit) : undefined,
        offset: offset ? Number.parseInt(offset) : undefined,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get unread notifications count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.id;
      const count = await notificationService.getUnreadCount(userId);

      res.json({
        success: true,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark notification as read
   * POST /api/notifications/:id/read
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await notificationService.markAsRead(userId, Number.parseInt(id));

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark multiple notifications as read
   * POST /api/notifications/read-bulk
   */
  async markManyAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { ids } = req.body;

      const count = await notificationService.markManyAsRead(
        userId,
        ids.map((id) => Number.parseInt(id))
      );

      res.json({
        success: true,
        message: `${count} notifications marked as read`,
        data: { count },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Archive notification
   * POST /api/notifications/:id/archive
   */
  async archiveNotification(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await notificationService.archiveNotification(userId, Number.parseInt(id));

      res.json({
        success: true,
        message: 'Notification archived',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
