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
  telegramLinkLimiter,
} = require('../middlewares/rate-limit.middleware');

router.get('/me', authenticateToken, profileController.getMyProfile);

router.patch('/me', 
  authenticateToken, 
  profileUpdateLimiter,
  verifyCSRFToken,
  validateBody(updateProfileSchema), 
  profileController.updateProfile
);

router.patch('/me/username', 
  authenticateToken, 
  usernameChangeLimiter,
  verifyCSRFToken,
  validateBody(updateUsernameSchema), 
  profileController.updateUsername
);

router.post('/me/avatar', 
  authenticateToken, 
  avatarUploadLimiter,
  verifyCSRFToken,
  uploadMiddleware,
  handleMulterError,
  profileController.uploadAvatar
);

router.delete('/me/avatar', 
  authenticateToken, 
  verifyCSRFToken,
  profileController.deleteAvatar
);

router.post('/telegram/link',
  authenticateToken,
  verifyCSRFToken,
  telegramLinkLimiter,
  profileController.generateTelegramLink
);

router.delete('/telegram/link',
  authenticateToken,
  verifyCSRFToken,
  profileController.unlinkTelegram
);

router.get('/user/:id', validateParams(userIdParamSchema), publicProfileLimiter, profileController.getProfileByUserId);

router.get('/:username', publicProfileLimiter, profileController.getProfileByUsername);

module.exports = router;
