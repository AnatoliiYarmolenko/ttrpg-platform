const { checkRateLimit, decrementRateLimit } = require('../services/rate-limit.service');

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

// Ліміт для запиту "Забув пароль"
const emailLimiter = createRedisLimiter({
  type: 'auth_forgot_password',
  windowMs: 60 * 60 * 1000, // 1 година
  max: 3, // 3 запити на годину
  message: { message: 'Забагато запитів на відновлення. Спробуйте пізніше.' },
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

// Ліміт для входу
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

// Ліміт для реєстрації
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
  message: { message: 'Занадто багато запитів на зміну email. Спробуйте пізніше.' },
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

// Ліміт для видалення акаунту
const deleteAccountLimiter = createRedisLimiter({
  type: 'security_delete_account',
  windowMs: 24 * 60 * 60 * 1000, // 24 години
  max: 3, // 3 спроби на добу
  message: { message: 'Занадто багато спроб видалення акаунту. Спробуйте завтра.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для оновлення профілю
const profileUpdateLimiter = createRedisLimiter({
  type: 'profile_update',
  windowMs: 15 * 60 * 1000, // 15 хвилин
  max: 30, // 30 оновлень за 15 хвилин
  message: { message: 'Занадто багато оновлень профілю. Спробуйте через 15 хвилин.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для зміни username)
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
  message: { message: 'Занадто багато завантажень аватара. Спробуйте пізніше.' },
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

// Ліміт для відправки повідомлень в чат (захист від спаму)
const chatSendMessageLimiter = createRedisLimiter({
  type: 'chat_send_message',
  windowMs: 10 * 1000, // 10 секунд
  max: 20, // 20 повідомлень за 10 секунд
  message: { message: 'Занадто багато повідомлень. Зачекайте трохи.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

// Ліміт для інжесту клієнтських логів
const clientLogLimiter = createRedisLimiter({
  type: 'client_log_ingest',
  windowMs: 60 * 1000, // 1 хвилина
  max: 30, // 30 логів/хвилину на IP
  message: { message: 'Занадто багато логів з клієнта. Спробуйте пізніше.' },
  statusCode: 429,
});

const telegramLinkLimiter = createRedisLimiter({
  type: 'profile_telegram_link',
  windowMs: 60 * 1000,
  max: 3,
  message: { message: 'Занадто багато спроб генерації токена. Зачекайте хвилину.' },
  statusCode: 429,
  keyGenerator: (req) => String(req.user?.id || getClientIp(req)),
});

module.exports = {
  loginLimiter,
  registerLimiter,
  emailLimiter,
  resendVerificationLimiter,
  verifyEmailLimiter,

  changePasswordLimiter,
  emailChangeLimiter,
  confirmEmailChangeLimiter,
  deleteAccountLimiter,

  profileUpdateLimiter,
  usernameChangeLimiter,
  avatarUploadLimiter,
  publicProfileLimiter,
  clientLogLimiter,
  chatSendMessageLimiter,
  telegramLinkLimiter,
};