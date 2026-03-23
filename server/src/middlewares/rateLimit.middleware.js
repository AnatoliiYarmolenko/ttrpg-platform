const { checkRateLimit, decrementRateLimit } = require('../services/rateLimit.service');

function getClientIp(req) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(ip).replace(/^\[|\]$/g, '');
}

function createRedisLimiter({
  type,
  windowMs,
  max,
  message,
  statusCode = 429,
  keyGenerator = (req) => getClientIp(req),
  skipSuccessfulRequests = false,
}) {
  return async (req, res, next) => {
    const key = keyGenerator(req);

    try {
      await checkRateLimit(type, key, {
        maxRequests: max,
        windowMs,
        blockDurationMs: windowMs,
      });

      if (skipSuccessfulRequests) {
        res.once('finish', () => {
          if (res.statusCode < 400) {
            decrementRateLimit(type, key).catch(() => {});
          }
        });
      }

      next();
    } catch (error) {
      if (error.status === 429) {
        if (error.retryAfter) {
          res.set('Retry-After', String(error.retryAfter));
        }

        return res.status(statusCode).json(message);
      }

      return next(error);
    }
  };
}

/**
 * Rate limiter.
 */

// Ліміт для запиту "Забув пароль"
const emailLimiter = createRedisLimiter({
  type: 'auth_forgot_password',
  windowMs: 60 * 60 * 1000, // 1 година
  max: 3, // Збільшив до 3, щоб було трохи лояльніше
  message: { message: 'Забагато запитів на відновлення. Спробуйте через годину.' },
});

// Ліміт для повторної відправки підтвердження пошти
const resendVerificationLimiter = createRedisLimiter({
  type: 'auth_resend_verification',
  windowMs: 60 * 60 * 1000, // 1 година
  max: 3, // Максимум 3 листи на годину
  message: { message: 'Ви надсилаєте листи занадто часто. Зачекайте годину.' },
});

// Ліміт для переходу по посиланню верифікації (захист від brute-force токенів)
const verifyEmailLimiter = createRedisLimiter({
  type: 'auth_verify_email',
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 10, // 10 спроб перевірки
  message: { message: 'Занадто багато спроб підтвердження. Спробуйте пізніше.' },
});

const loginLimiter = createRedisLimiter({
  type: 'auth_login',
  windowMs: 15 * 60 * 1000, 
  max: 5, 
  message: { message: 'Занадто багато спроб входу. Спробуйте знову через 15 хвилин.' },
  statusCode: 429,
  keyGenerator: (req) => {
    const ip = getClientIp(req);
    const email = req.body?.email || 'unknown';
    return `${ip}-${email}`;
  },
  skipSuccessfulRequests: true, // Якщо логін успішний, лічильник не росте
});

const registerLimiter = createRedisLimiter({
  type: 'auth_register',
  windowMs: 60 * 60 * 1000, // 1 година
  max: 5, // максимум 5 спроби реєстрації з одного IP
  message: {
    message: 'Занадто багато спроб реєстрації. Спробуйте пізніше.',
  },
  statusCode: 429,
  skipSuccessfulRequests: true,
});

// ===== SECURITY ENDPOINTS RATE LIMITERS =====

// Ліміт для зміни пароля (захист від brute-force)
const changePasswordLimiter = createRedisLimiter({
  type: 'security_change_password',
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 5, // 5 спроб за 15 хвилин
  message: { message: 'Занадто багато спроб зміни пароля. Спробуйте через 15 хвилин.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
  skipSuccessfulRequests: true, // Успішна зміна не рахується
});

// Ліміт для запиту зміни email
const emailChangeLimiter = createRedisLimiter({
  type: 'security_email_change',
  windowMs: 60 * 60 * 1000, // 1 година
  max: 3, // 3 спроби на годину
  message: { message: 'Занадто багато запитів на зміну email. Спробуйте через годину.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для підтвердження зміни email (захист від brute-force токенів)
const confirmEmailChangeLimiter = createRedisLimiter({
  type: 'security_confirm_email_change',
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 10, // 10 спроб
  message: { message: 'Занадто багато спроб підтвердження. Спробуйте пізніше.' },
  statusCode: 429,
});

// Ліміт для видалення акаунту (суворий - 3 спроби на день)
const deleteAccountLimiter = createRedisLimiter({
  type: 'security_delete_account',
  windowMs: 24 * 60 * 60 * 1000, // 24 години
  max: 3, // 3 спроби на добу
  message: { message: 'Занадто багато спроб видалення акаунту. Спробуйте завтра.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// ===== PROFILE ENDPOINTS RATE LIMITERS =====

// Ліміт для оновлення профілю
const profileUpdateLimiter = createRedisLimiter({
  type: 'profile_update',
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 30, // 30 оновлень за 15 хвилин
  message: { message: 'Занадто багато оновлень профілю. Спробуйте через 15 хвилин.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для зміни username (суворий - рідка операція)
const usernameChangeLimiter = createRedisLimiter({
  type: 'profile_username_change',
  windowMs: 24 * 60 * 60 * 1000, // 24 години
  max: 3, // 3 спроби на добу
  message: { message: 'Занадто багато спроб зміни username. Спробуйте завтра.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для завантаження аватара
const avatarUploadLimiter = createRedisLimiter({
  type: 'profile_avatar_upload',
  windowMs: 60 * 60 * 1000, // 1 година
  max: 10, // 10 завантажень на годину
  message: { message: 'Занадто багато завантажень аватара. Спробуйте через годину.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для публічного профілю (захист від enumeration)
const publicProfileLimiter = createRedisLimiter({
  type: 'profile_public_view',
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 100, // 100 запитів за 15 хвилин
  message: { message: 'Занадто багато запитів. Спробуйте пізніше.' },
  statusCode: 429,
});

module.exports = {
  loginLimiter,
  registerLimiter,
  emailLimiter,
  resendVerificationLimiter,
  verifyEmailLimiter,
  // Security endpoints
  changePasswordLimiter,
  emailChangeLimiter,
  confirmEmailChangeLimiter,
  deleteAccountLimiter,
  // Profile endpoints
  profileUpdateLimiter,
  usernameChangeLimiter,
  avatarUploadLimiter,
  publicProfileLimiter,
};