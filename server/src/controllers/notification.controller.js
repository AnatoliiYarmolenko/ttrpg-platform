const notificationService = require('../services/notification.service');
const sseService = require('../services/notification/notification-sse.service');

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
   * Get active notifications count
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
   * Consume notification and move it to archive
   * POST /api/notifications/:id/read
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      await notificationService.markAsRead(userId, Number.parseInt(id));

      res.json({
        success: true,
        message: 'Notification archived',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Consume multiple notifications and move them to archive
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
        message: `${count} notifications archived`,
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

  /**
   * SSE stream for live notifications
   * GET /api/notifications/stream
   */
  async stream(req, res, next) {
    try {
      const userId = req.user.id;

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Register connection
      sseService.registerConnection(userId, res);

      // Send initial keep-alive comment
      res.write(':ok\n\n');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
