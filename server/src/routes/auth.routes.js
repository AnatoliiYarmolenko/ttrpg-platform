const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { validateBody } = require('../middlewares/validation.middleware');
// Додаємо імпорт схеми forgotPasswordSchema (вона перевіряє просто email)
const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require('../validation/auth.validation');
// Імпортуємо нові лімітери
const { 
  loginLimiter, 
  registerLimiter, 
  emailLimiter, 
  resendVerificationLimiter, 
  verifyEmailLimiter 
} = require('../middlewares/rate-limit.middleware');
const { setCSRFToken, verifyCSRFToken } = require('../middlewares/csrf.middleware');

// GET endpoint для отримання CSRF токена
router.get('/csrf-token', setCSRFToken, (req, res) => {
  res.json({ message: 'CSRF токен встановлено' });
});

// Встановлюємо CSRF токен для всіх запитів
router.use(setCSRFToken);

// Реєстрація та Вхід
router.post('/register', registerLimiter, verifyCSRFToken, validateBody(registerSchema), authController.register);
router.post('/login', loginLimiter, verifyCSRFToken, validateBody(loginSchema), authController.login);

// 🔐 Відновлення пароля
router.post('/forgot-password', emailLimiter, validateBody(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', registerLimiter, verifyCSRFToken, validateBody(resetPasswordSchema), authController.resetPassword);

// 📩 Повторна відправка листа підтвердження (Новий роут)
// Використовуємо forgotPasswordSchema, бо там валідація лише email поля
router.post('/resend-verification', resendVerificationLimiter, validateBody(forgotPasswordSchema), authController.resendVerification);

// 📩 Верифікація email (Додано лімітер)
router.get('/verify-email', verifyEmailLimiter, authController.verifyEmail);

// Токени та Вихід
router.post('/refresh', verifyCSRFToken, authController.refresh);
router.post('/logout', verifyCSRFToken, authController.logout);

module.exports = router;