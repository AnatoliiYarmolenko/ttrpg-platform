const notificationService = require('../services/notification.service');
const sseService = require('../services/notification/notification-sse.service');

class NotificationController {
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

  async stream(req, res, next) {
    try {
      const userId = req.user.id;

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      sseService.registerConnection(userId, res);

      res.write(':ok\n\n');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
