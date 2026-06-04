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


router.patch('/password', 
  authenticateToken, 
  changePasswordLimiter,
  verifyCSRFToken,
  validateBody(changePasswordSchema), 
  securityController.changePassword
);

router.post('/email', 
  authenticateToken, 
  emailChangeLimiter,
  verifyCSRFToken,
  validateBody(requestEmailChangeSchema), 
  securityController.requestEmailChange
);

router.delete('/account', 
  authenticateToken, 
  deleteAccountLimiter,
  verifyCSRFToken,
  validateBody(deleteAccountSchema), 
  securityController.deleteAccount
);

router.post('/confirm-email-change', 
  confirmEmailChangeLimiter,
  verifyCSRFToken,
  validateBody(confirmEmailChangeSchema), 
  securityController.confirmEmailChange
);

module.exports = router;
