const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { jwtSecret } = require('../config/config');
const emailService = require('./email.service');
const { checkRefreshRateLimit } = require('./rateLimit.service');
const { createError, AppError, ERROR_CODES } = require('../constants/errors');
const { isUserDeleted } = require('../store/deletedUsers');
const { redis } = require('../lib/redis');
const { logger } = require('../lib/logger');

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : email;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getTokenCandidates(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return [];
  }

  const normalized = token.trim();
  if (!normalized) {
    return [];
  }

  const hashed = hashToken(normalized);
  return normalized === hashed ? [normalized] : [normalized, hashed];
}

function createRawAndHashedToken(bytes = 32) {
  const rawToken = crypto.randomBytes(bytes).toString('hex');
  return {
    rawToken,
    tokenHash: hashToken(rawToken),
  };
}

/**
 * Отримує distributed lock для refresh операції конкретного користувача.
 * Використовує Redis SET NX PX — атомарна операція "встанови якщо не існує".
 *
 * @param {number} userId
 * @param {number} ttlMs - TTL блокування в мілісекундах (за замовчуванням 5 секунд)
 * @returns {Promise<string|null>} lockValue (для release) або null якщо lock зайнятий
 */
async function acquireRefreshLock(userId, ttlMs = 5000) {
  const lockKey = `lock:refresh:${userId}`;
  // Унікальне значення щоб тільки власник lock міг його звільнити
  const lockValue = crypto.randomBytes(16).toString('hex');
  // SET key value NX PX ttl — ставить ключ тільки якщо його ще немає
  const result = await redis.set(lockKey, lockValue, 'NX', 'PX', ttlMs);
  return result === 'OK' ? lockValue : null;
}

/**
 * Звільняє distributed lock тільки якщо він належить цьому власнику (через lockValue).
 * Lua script гарантує атомарність перевірки + видалення.
 *
 * @param {number} userId
 * @param {string} lockValue - значення отримане з acquireRefreshLock
 */
async function releaseRefreshLock(userId, lockValue) {
  const lockKey = `lock:refresh:${userId}`;
  // Атомарно: перевір що value співпадає → тоді видали. Інакше нічого не роби.
  const luaScript = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(luaScript, 1, lockKey, lockValue);
}


class AuthService {
  async verifyEmailToken(token) {
    const prismaClient = prisma;
    const now = new Date();
    const tokenCandidates = getTokenCandidates(token);

    if (tokenCandidates.length === 0) {
      return { success: false, message: 'Токен не знайдено або вже використано.' };
    }
    
    // Шукаємо токен
    const record = await prismaClient.emailVerificationToken.findFirst({
      where: {
        token: { in: tokenCandidates },
      },
      include: { user: true },
    });

    if (!record) {
      return { success: false, message: 'Токен не знайдено або вже використано.' };
    }

    if (record.expiresAt < now) {
      // Видаляємо прострочений токен, щоб не засмічувати БД
      await prismaClient.emailVerificationToken.delete({ where: { id: record.id } });
      return { success: false, message: 'Термін дії посилання вичерпано. Запросіть нове.' };
    }

    // Виконуємо в транзакції: оновлюємо юзера і видаляємо токен
    await prismaClient.$transaction([
      prismaClient.user.update({
        where: { id: record.userId },
        data: { emailVerified: true }
      }),
      prismaClient.emailVerificationToken.deleteMany({ 
        where: { userId: record.userId } // Видаляємо всі токени цього юзера
      })
    ]);

    return { success: true };
  }

// 📩 Повторна відправка листа верифікації (ОНОВЛЕНО: Smart Logic)
  async resendVerificationEmail(email) {
    const prismaClient = prisma;
    const normalizedEmail = normalizeEmail(email);
    const genericMessage = 'Якщо цей email зареєстрований, лист відправлено.';

    const user = await prismaClient.user.findFirst({
      where: { email: normalizedEmail, isDeleted: false },
      select: { id: true, email: true, username: true, emailVerified: true }
    });

    // Єдина відповідь для захисту від user enumeration
    if (!user) {
      return { message: genericMessage };
    }

    if (user.emailVerified) {
      return { message: genericMessage };
    }

    await prismaClient.emailVerificationToken.deleteMany({
      where: { userId: user.id }
    });

    const { rawToken, tokenHash } = createRawAndHashedToken(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 хвилин

    await prismaClient.emailVerificationToken.create({
      data: {
        token: tokenHash,
        userId: user.id,
        expiresAt
      }
    });

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
    
    const emailResult = await emailService.sendEmailVerificationEmail(user.email, verificationUrl, user.username);
    
    if (!emailResult.success) {
      throw createError.emailSendFailed();
    }

    return { message: genericMessage };
  }
  // Функція реєстрації
  async registerUser(username, email, password) {
    const prismaClient = prisma;
    const normalizedEmail = normalizeEmail(email);
        
    // 1. Перевіряємо Username

    const existingUserByUsername = await prismaClient.user.findFirst({ 
      where: { username: username },
      select: { id: true }
    });
    
    if (existingUserByUsername) {
      throw createError.usernameTaken();
    }

    // 2. Перевіряємо Email
    const existingUserByEmail = await prismaClient.user.findUnique({ 
      where: { email: normalizedEmail },
      select: { id: true }
    });

    if (existingUserByEmail) {
      throw createError.emailTaken();
    }

    

    // 3. Хешуємо пароль (далі код без змін...)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Створюємо юзера і одразу гаманець для нього (згідно з ТЗ)
    const newUser = await prismaClient.user.create({
      data: {
        username,
        email: normalizedEmail,
        password: hashedPassword,
        wallet: {
          create: { balance: 0.0 }
        }
      },
      select: {
        id: true,
        username: true,
        email: true,
        createdAt: true
      }
    });
    // Додаємо email verification
    const { rawToken, tokenHash } = createRawAndHashedToken(32);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 хвилин
    await prismaClient.emailVerificationToken.create({
      data: {
        token: tokenHash,
        userId: newUser.id,
        expiresAt
      }
    });
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${rawToken}`;
    await emailService.sendEmailVerificationEmail(newUser.email, verificationUrl, newUser.username);
    return newUser;
  }

  // Функція входу
  async loginUser(email, password) {
    const prismaClient = prisma;
    const normalizedEmail = normalizeEmail(email);
    
    // 1. Оптимізація: Вибираємо тільки ті поля, які нам потрібні для перевірки та відповіді
    const user = await prismaClient.user.findFirst({ 
      where: { email: normalizedEmail, isDeleted: false },
      select: {
        id: true,
        email: true, // Обов'язково додаємо, бо повертаємо його в об'єкті user
        username: true,
        password: true,
        emailVerified: true,
        role: true,
      }
    });
    
    // Якщо користувача не знайдено - помилка
    if (!user) {
      throw createError.invalidCredentials();
    }

    // 2. Оптимізація: Перевіряємо статус email ПЕРЕД важкою операцією порівняння пароля
    // Це економить ресурси CPU і дозволяє швидше повернути 403, щоб спрацював наш редірект на фронті
    if (!user.emailVerified) {
      throw createError.emailNotVerified();
    }

    // 3. Важка операція (bcrypt) виконується тільки якщо попередні перевірки пройшли
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      throw createError.invalidCredentials();
    }

    // 4. Генерація токенів
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, 
      jwtSecret, 
      { expiresIn: '15m' }
    );
    
    const { rawToken: refreshToken, tokenHash: refreshTokenHash } = createRawAndHashedToken(64);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 днів

    const MAX_SESSIONS = 5;
    const now = new Date();

    // Видаляємо всі прострочені токени цього юзера
    await prismaClient.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: now } }
    });

    // Якщо активних сесій >= MAX_SESSIONS — видаляємо найстаріші
    const activeSessions = await prismaClient.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (activeSessions.length >= MAX_SESSIONS) {
      const toDelete = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
      await prismaClient.refreshToken.deleteMany({
        where: { id: { in: toDelete.map(t => t.id) } }
      });
    }

    // Зберігаємо новий refresh token
    await prismaClient.refreshToken.create({
      data: { token: refreshTokenHash, userId: user.id, expiresAt }
    });
    
    // Повертаємо результат (пароль не повертаємо, він залишився в select, але не йде в return)
    return { 
      accessToken, 
      refreshToken, 
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role,
      } 
    };
  }

  // Обмін refresh токена на нові токени (ротація) з distributed lock через Redis
  async refreshTokens(oldRefreshToken) {
    const prismaClient = prisma;
    
    if (!prismaClient || !prismaClient.refreshToken) {
      logger.error('Prisma Client або модель refreshToken недоступні');
      throw createError.serverError();
    }

    if (!oldRefreshToken) {
      throw createError.refreshTokenMissing();
    }

    const tokenCandidates = getTokenCandidates(oldRefreshToken);
    if (tokenCandidates.length === 0) {
      throw createError.refreshTokenInvalid();
    }

    // Перший запит — отримуємо userId для блокування та rate limit перевірки
    let stored = await prismaClient.refreshToken.findFirst({ 
      where: { token: { in: tokenCandidates } },
      select: { id: true, userId: true, expiresAt: true }
    });
    
    if (!stored) {
      throw createError.refreshTokenInvalid();
    }

    if (new Date() > stored.expiresAt) {
      throw createError.refreshTokenExpired();
    }

    // 🔥 RATE LIMITING — перевіряємо ліміт запитів для користувача
    await checkRefreshRateLimit(stored.userId);

    // 🔒 Отримуємо distributed lock через Redis (SET NX PX)
    // Якщо Redis тимчасово недоступний — продовжуємо без lock (fail-open)
    // щоб не ламати refresh потік повністю.
    let lockValue = null;
    try {
      lockValue = await acquireRefreshLock(stored.userId, 5000);
      if (!lockValue) {
        // Lock зайнятий — просто повертаємо помилку, клієнт може retry
        throw createError.rateLimitExceeded(5);
      }
    } catch (err) {
      if (err && err.status === 429) {
        throw err;
      }
      logger.error({ err, userId: stored.userId }, '[Auth] Redis lock недоступний');
    }

    try {
      // ⚡ КРИТИЧНО: Перевіряємо токен ЗНОВУ після отримання блокування
      // (інша вкладка могла вже його видалити)
      const storedAgain = await prismaClient.refreshToken.findFirst({ 
        where: { token: { in: tokenCandidates } },
        select: { id: true, userId: true, expiresAt: true }
      });

      if (!storedAgain) {
        throw createError.refreshTokenInvalid();
      }

      // Очищаємо прострочені токени цього користувача
      const now = new Date();
      await prismaClient.refreshToken.deleteMany({
        where: { userId: storedAgain.userId, expiresAt: { lt: now } },
      });

      // Завантажуємо користувача
      const user = await prismaClient.user.findUnique({ 
        where: { id: storedAgain.userId },
        select: { id: true, username: true, email: true, role: true }
      });
      
      if (!user) {
        throw createError.userNotFound();
      }

      // Перевіряємо blacklist анонімізованих акаунтів (тепер async)
      if (await isUserDeleted(user.id)) {
        throw createError.userNotFound();
      }

      // Видаляємо старий refresh token
      await prismaClient.refreshToken.delete({ where: { id: storedAgain.id } });

      // Створюємо нові токени
      const accessToken = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        jwtSecret,
        { expiresIn: '15m' }
      );
      const { rawToken: newRefreshToken, tokenHash: newRefreshTokenHash } = createRawAndHashedToken(64);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 днів

      await prismaClient.refreshToken.create({ 
        data: { token: newRefreshTokenHash, userId: user.id, expiresAt } 
      });

      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: new Date(),
      };

      return { accessToken, refreshToken: newRefreshToken, user: safeUser };
    } finally {
      // Завжди звільняємо lock, якщо він був встановлений
      if (lockValue) {
        try {
          await releaseRefreshLock(stored.userId, lockValue);
        } catch (err) {
          logger.error({ err, userId: stored.userId }, '[Auth] Не вдалося звільнити Redis lock');
        }
      }
    }
  }

  // Відкликати (revoke) refresh token
  async revokeRefreshToken(refreshToken) {
    const prismaClient = prisma;
    if (!refreshToken) return;
    const tokenCandidates = getTokenCandidates(refreshToken);
    if (tokenCandidates.length === 0) return;
    if (!prismaClient || !prismaClient.refreshToken) {
      // Якщо Prisma недоступний, просто ігноруємо (не критична помилка для logout)
      return;
    }
    try {
      // Видаляємо токен напряму (deleteMany не кидає помилку якщо не знайдено)
      await prismaClient.refreshToken.deleteMany({ 
        where: {
          token: { in: tokenCandidates },
        }
      });
    } catch (e) {
      // ignore errors here; caller will still clear cookies
    }
  }

  // 🔐 Запит на ресет пароля
  async requestPasswordReset(email) {
    const prismaClient = prisma;
    const normalizedEmail = normalizeEmail(email);
    
    // 1. Перевіряємо, чи існує користувач з таким email
    const user = await prismaClient.user.findFirst({
      where: { email: normalizedEmail, isDeleted: false },
      select: { id: true, email: true, username: true }
    });

    if (!user) {
      // З безпеки не говоримо, що email не існує (запобігаємо перебиранню email)
      return { 
        message: "Якщо email зареєстрований, ви отримаєте посилання для ресету" 
      };
    }

    // 2. Генеруємо унікальний токен для ресету
    const { rawToken: resetToken, tokenHash: resetTokenHash } = createRawAndHashedToken(32);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // TTL: 1 година

    // 3. Зберігаємо токен у БД
    await prismaClient.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetTokenHash,
        passwordResetExpiry: resetExpiry
      }
    });

    // 4. Генеруємо URL для ресету
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // 5. Надсилаємо email користувачу
    const emailResult = await emailService.sendPasswordResetEmail(
      user.email,
      resetUrl,
      user.username || 'Користувач'
    );

    const shouldExposeResetDebugData =
      process.env.NODE_ENV !== 'production' && process.env.EXPOSE_AUTH_DEBUG_TOKENS === 'true';

    // Повертаємо результат (успішно чи ні)
    return {
      message: "Посилання для ресету надіслано",
      emailSent: emailResult.success,
      emailMessage: emailResult.message,
      // Тільки якщо явно ввімкнено debug-прапором поза production
      ...(shouldExposeResetDebugData && { resetToken, resetUrl })
    };
  }

  // 🔐 Скинути пароль
  async resetPassword(resetToken, newPassword) {
    const prismaClient = prisma;
    const now = new Date();
    const tokenCandidates = getTokenCandidates(resetToken);

    if (tokenCandidates.length === 0) {
      throw createError.passwordResetTokenInvalid();
    }

    // 1. Шукаємо користувача по токену
    const user = await prismaClient.user.findFirst({
      where: {
        passwordResetToken: {
          in: tokenCandidates,
        },
      },
      select: { 
        id: true, 
        passwordResetExpiry: true,
        username: true,
        email: true
      }
    });

    if (!user) {
      throw createError.passwordResetTokenInvalid();
    }

    // 2. Перевіряємо, чи не прострочено токен
    if (!user.passwordResetExpiry || now > user.passwordResetExpiry) {
      throw new AppError(ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED);
    }

    // 3. Валідація нового пароля (відповідає схемі валідації - мінімум 8 символів)
    if (!newPassword || newPassword.length < 8) {
      throw new AppError(ERROR_CODES.PASSWORD_TOO_WEAK, 'Пароль повинен бути мінімум 8 символів');
    }

    // 4. Хешуємо новий пароль
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Оновлюємо пароль, видаляємо токен ресету та інвалідуємо всі сесії
    await prismaClient.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpiry: null
        }
      });

      await tx.refreshToken.deleteMany({
        where: { userId: user.id },
      });
    });

    return {
      message: "Пароль успішно скинуто",
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    };
  }
}

module.exports = new AuthService();
