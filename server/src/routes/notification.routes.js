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

router.get(
  '/',
  [authenticateToken, validateGetNotifications],
  (req, res, next) => notificationController.getNotifications(req, res, next)
);

router.get(
  '/unread-count',
  [authenticateToken],
  (req, res, next) => notificationController.getUnreadCount(req, res, next)
);

router.post(
  '/:id/read',
  [authenticateToken, verifyCSRFToken, validateNotificationId],
  (req, res, next) => notificationController.markAsRead(req, res, next)
);

router.post(
  '/read-bulk',
  [authenticateToken, verifyCSRFToken, validateMarkManyAsRead],
  (req, res, next) => notificationController.markManyAsRead(req, res, next)
);

router.get(
  '/stream',
  [authenticateToken],
  (req, res, next) => notificationController.stream(req, res, next)
);

module.exports = router;
