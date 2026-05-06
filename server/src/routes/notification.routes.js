const express = require('express');

const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const notificationController = require('../controllers/notification.controller');

const {
  validateGetNotifications,
  validateNotificationId,
  validateMarkManyAsRead,
} = require('../validation/notification.validation');

// Get notifications list
router.get(
  '/',
  [authenticateToken, validateGetNotifications],
  (req, res, next) => notificationController.getNotifications(req, res, next)
);

// Get unread count
router.get(
  '/unread-count',
  [authenticateToken],
  (req, res, next) => notificationController.getUnreadCount(req, res, next)
);

// Mark as read
router.post(
  '/:id/read',
  [authenticateToken, verifyCSRFToken, validateNotificationId],
  (req, res, next) => notificationController.markAsRead(req, res, next)
);

// Mark many as read
router.post(
  '/read-bulk',
  [authenticateToken, verifyCSRFToken, validateMarkManyAsRead],
  (req, res, next) => notificationController.markManyAsRead(req, res, next)
);

// Archive notification
router.post(
  '/:id/archive',
  [authenticateToken, verifyCSRFToken, validateNotificationId],
  (req, res, next) => notificationController.archiveNotification(req, res, next)
);

// SSE stream for live notifications (no CSRF needed for GET)
router.get(
  '/stream',
  [authenticateToken],
  (req, res, next) => notificationController.stream(req, res, next)
);

module.exports = router;
