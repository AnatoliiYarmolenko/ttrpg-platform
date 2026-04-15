const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');
const { validateBody } = require('../middlewares/validation.middleware');
const { 
  changePasswordSchema,
  requestEmailChangeSchema,
  confirmEmailChangeSchema,
  deleteAccountSchema,
} = require('../validation/security.validation');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const {
  changePasswordLimiter,
  emailChangeLimiter,
  confirmEmailChangeLimiter,
  deleteAccountLimiter,
} = require('../middlewares/rate-limit.middleware');

// ===== ЗАХИЩЕНІ РОУТИ (потребують авторизації) =====

// Змінити пароль
router.patch('/password', 
  authenticateToken, 
  changePasswordLimiter,
  verifyCSRFToken,
  validateBody(changePasswordSchema), 
  securityController.changePassword
);

// Запит на зміну email
router.post('/email', 
  authenticateToken, 
  emailChangeLimiter,
  verifyCSRFToken,
  validateBody(requestEmailChangeSchema), 
  securityController.requestEmailChange
);

// Видалити акаунт
router.delete('/account', 
  authenticateToken, 
  deleteAccountLimiter,
  verifyCSRFToken,
  validateBody(deleteAccountSchema), 
  securityController.deleteAccount
);

// ===== ПУБЛІЧНІ РОУТИ =====

// Підтвердити зміну email (з токеном)
router.post('/confirm-email-change', 
  confirmEmailChangeLimiter,
  validateBody(confirmEmailChangeSchema), 
  securityController.confirmEmailChange
);

module.exports = router;
