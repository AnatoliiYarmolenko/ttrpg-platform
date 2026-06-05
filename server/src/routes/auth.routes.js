const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateBody } = require('../middlewares/validation.middleware');
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/auth.validation');
const { 
  loginLimiter, 
  registerLimiter, 
  emailLimiter, 
  resendVerificationLimiter, 
  verifyEmailLimiter 
} = require('../middlewares/rate-limit.middleware');
const { setCSRFToken, verifyCSRFToken } = require('../middlewares/csrf.middleware');

router.get('/csrf-token', setCSRFToken, (req, res) => {
  res.json({ message: 'CSRF токен встановлено' });
});

router.use(setCSRFToken);

router.post('/register', registerLimiter, verifyCSRFToken, validateBody(registerSchema), authController.register);
router.post('/login', loginLimiter, verifyCSRFToken, validateBody(loginSchema), authController.login);

router.post('/forgot-password', emailLimiter, verifyCSRFToken, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', registerLimiter, verifyCSRFToken, validateBody(resetPasswordSchema), authController.resetPassword);

router.post('/resend-verification', resendVerificationLimiter, verifyCSRFToken, validateBody(forgotPasswordSchema), authController.resendVerification);

router.get('/verify-email', verifyEmailLimiter, authController.verifyEmail);

router.post('/refresh', verifyCSRFToken, authController.refresh);
router.post('/logout', verifyCSRFToken, authController.logout);

module.exports = router;