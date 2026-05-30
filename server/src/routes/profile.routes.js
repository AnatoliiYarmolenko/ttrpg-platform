const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { validateBody, validateParams } = require('../middlewares/validation.middleware');
const { 
  updateProfileSchema, 
  updateUsernameSchema, 
  userIdParamSchema,
} = require('../validation/profile.validation');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const { uploadMiddleware, handleMulterError } = require('../services/upload.service');
const {
  profileUpdateLimiter,
  usernameChangeLimiter,
  avatarUploadLimiter,
  publicProfileLimiter,
} = require('../middlewares/rate-limit.middleware');

// ===== ЗАХИЩЕНІ РОУТИ (потребують авторизації) =====

// Отримати власний профіль
router.get('/me', authenticateToken, profileController.getMyProfile);

// Оновити профіль
router.patch('/me', 
  authenticateToken, 
  profileUpdateLimiter,
  verifyCSRFToken,
  validateBody(updateProfileSchema), 
  profileController.updateProfile
);

// Оновити username (окремий endpoint)
router.patch('/me/username', 
  authenticateToken, 
  usernameChangeLimiter,
  verifyCSRFToken,
  validateBody(updateUsernameSchema), 
  profileController.updateUsername
);

// Завантажити аватар
router.post('/me/avatar', 
  authenticateToken, 
  avatarUploadLimiter,
  verifyCSRFToken,
  uploadMiddleware,
  handleMulterError,
  profileController.uploadAvatar
);

// Видалити аватар
router.delete('/me/avatar', 
  authenticateToken, 
  verifyCSRFToken,
  profileController.deleteAvatar
);

// Згенерувати токен прив'язки Telegram
router.get('/telegram/link',
  authenticateToken,
  profileController.generateTelegramLink
);

// Відв'язати Telegram
router.delete('/telegram/link',
  authenticateToken,
  verifyCSRFToken,
  profileController.unlinkTelegram
);

// ===== ПУБЛІЧНІ РОУТИ =====

// Отримати профіль за userId (публічний) — до /:username щоб не конфліктував
router.get('/user/:id', validateParams(userIdParamSchema), publicProfileLimiter, profileController.getProfileByUserId);

// Отримати профіль за username (публічний)
router.get('/:username', publicProfileLimiter, profileController.getProfileByUsername);

module.exports = router;
