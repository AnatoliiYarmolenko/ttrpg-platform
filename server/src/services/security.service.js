const { prisma } = require('../lib/prisma');
const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const { createError, AppError, ERROR_CODES } = require('../constants/errors');
const { markUserAsDeleted } = require('../store/deleted-users');
const { logger } = require('../lib/logger');
const { hashToken, createRawAndHashedToken } = require('../utils/token.helper');
const { PASSWORD_HASH_ROUNDS, TOKEN_TTL_MS } = require('../config/tokens.config');
const { PRIVATE_PROFILE_FIELDS } = require('../constants/profile-fields');
const emailService = require('./email.service');
const { deleteOldAvatar } = require('./upload.service');

/**
 * Змінити пароль користувача
 * @param {number} userId - ID користувача
 * @param {string} currentPassword - Поточний пароль
 * @param {string} newPassword - Новий пароль
 * @returns {Promise<boolean>} - Успішно чи ні
 */
async function changePassword(userId, currentPassword, newPassword) {
  // Отримуємо хеш поточного пароля
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  // Перевіряємо поточний пароль
  const isValidPassword = await bcrypt.compare(currentPassword, user.password);
  if (!isValidPassword) {
    throw createError.passwordInvalid();
  }

  // Перевіряємо, що новий пароль відрізняється від старого
  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw createError.passwordSameAsCurrent();
  }

  // Хешуємо новий пароль
  const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);

  // Оновлюємо пароль та інвалідуємо всі сесії атомарно
  await prisma.$transaction(async (tx) => {
    // Оновлюємо пароль
    await tx.user.update({
      where: { id: userId },
      data: { 
        password: hashedPassword,
        updatedAt: new Date(),
      },
    });

    const deletedTokens = await tx.refreshToken.deleteMany({ 
      where: { userId } 
    });
    
    logger.info({ userId, invalidatedSessions: deletedTokens.count }, '[Security] Інвалідовано сесії після зміни пароля');
  });

  return true;
}

/**
 * Запит на зміну email
 * @param {number} userId - ID користувача
 * @param {string} password - Поточний пароль для підтвердження
 * @param {string} newEmail - Новий email
 * @returns {Promise<Object>} - Результат операції
 */
async function requestEmailChange(userId, password, newEmail) {
  const normalizedNewEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : newEmail;
  
  // Отримуємо користувача
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, email: true, username: true },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  // Перевіряємо пароль
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw createError.passwordInvalid();
  }

  // Перевіряємо, що новий email відрізняється
  if (user.email.toLowerCase() === normalizedNewEmail) {
    throw createError.emailSameAsCurrent();
  }

  // Перевіряємо, чи email не зайнятий іншим користувачем
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedNewEmail },
  });

  if (existingUser) {
    throw createError.emailTaken();
  }

  // Видаляємо старі токени зміни email для цього користувача
  await prisma.emailChangeToken.deleteMany({
    where: { userId },
  });

  // Створюємо новий токен
  const { rawToken, tokenHash } = createRawAndHashedToken(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.EMAIL_CHANGE);

  await prisma.emailChangeToken.create({
    data: {
      token: tokenHash,
      userId,
      newEmail: normalizedNewEmail,
      expiresAt,
    },
  });

  // Формуємо URL підтвердження
  const confirmUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/confirm-email-change?token=${rawToken}`;

  // Надсилаємо лист на НОВИЙ email
  const emailResult = await emailService.sendEmailChangeConfirmation(
    normalizedNewEmail,
    confirmUrl,
    user.username
  );

  if (!emailResult.success) {
    throw createError.emailSendFailed();
  }

  return { message: 'Лист для підтвердження надіслано на новий email' };
}

/**
 * Підтвердити зміну email
 * @param {string} token - Токен підтвердження
 * @returns {Promise<Object>} - Оновлений профіль
 */
async function confirmEmailChange(token) {
  const tokenHash = hashToken(token);

  if (!tokenHash) {
    throw new AppError(ERROR_CODES.EMAIL_CHANGE_TOKEN_INVALID);
  }

  // Знаходимо токен
  const record = await prisma.emailChangeToken.findFirst({
    where: {
      token: tokenHash,
    },
    include: { user: true },
  });

  if (!record) {
    throw new AppError(ERROR_CODES.EMAIL_CHANGE_TOKEN_INVALID);
  }

  // Перевіряємо термін дії
  if (record.expiresAt < new Date()) {
    // Видаляємо прострочений токен
    await prisma.emailChangeToken.deleteMany({ where: { id: record.id } });
    throw new AppError(ERROR_CODES.EMAIL_CHANGE_TOKEN_EXPIRED);
  }

  // Ще раз перевіряємо, чи email не зайнятий
  const existingUser = await prisma.user.findUnique({
    where: { email: record.newEmail },
  });

  if (existingUser) {
    await prisma.emailChangeToken.deleteMany({ where: { id: record.id } });
    throw createError.emailTaken();
  }

  // Виконуємо в транзакції: видаляємо токен і оновлюємо email атомарно
  const updatedUser = await prisma.$transaction(async (tx) => {
    // Спочатку видаляємо токен (щоб запобігти повторному використанню)
    await tx.emailChangeToken.deleteMany({ where: { id: record.id } });
    
    // Потім оновлюємо email
    return await tx.user.update({
      where: { id: record.userId },
      data: { 
        email: record.newEmail,
        emailVerified: true, // Новий email вже підтверджений
        updatedAt: new Date(),
      },
      select: PRIVATE_PROFILE_FIELDS,
    });
  });

  logger.info({ userId: record.userId, newEmail: record.newEmail }, '[Security] Email змінено');

  return updatedUser;
}

/**
 * Видалити акаунт користувача (soft delete via анонімізація)
 * @param {number} userId - ID користувача
 * @param {string} password - Пароль для підтвердження
 * @returns {Promise<boolean>} - Успішно чи ні
 */
async function deleteAccount(userId, password) {
  // Отримуємо користувача
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, username: true, email: true, avatarUrl: true },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  // Перевіряємо пароль
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw createError.passwordInvalid();
  }

  // Перевіряємо, що користувач не є власником активних кампаній
  const ownedCampaignsCount = await prisma.campaign.count({
    where: { 
      ownerId: userId,
      status: { not: 'FINISHED' }  // Тільки активні кампанії блокують видалення
    },
  });

  if (ownedCampaignsCount > 0) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      'Неможливо видалити акаунт, поки ви є власником активних кампаній. Спочатку завершіть їх.'
    );
  }

  // Генеруємо анонімні дані
  const timestamp = Date.now();
  const anonymousEmail = `deleted+${userId}+${timestamp}@deleted.local`;
  const anonymousUsername = `deleted_user_${userId}_${timestamp}`;
  const anonymousRawPassword = crypto.randomBytes(32).toString('hex');
  const anonymousPassword = await bcrypt.hash(anonymousRawPassword, PASSWORD_HASH_ROUNDS);

  // Виконуємо анонімізацію в транзакції
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.emailVerificationToken.deleteMany({ where: { userId } });
    await tx.emailChangeToken.deleteMany({ where: { userId } });
    
    await tx.joinRequest.updateMany({
      where: { reviewedBy: userId },
      data: { reviewedBy: null }
    });

    await tx.session.updateMany({
      where: { 
        ownerId: userId,
        status: { not: 'CANCELED' }
      },
      data: { status: 'CANCELED' }
    });

    await tx.campaign.updateMany({
      where: {
        ownerId: userId,
        status: { not: 'FINISHED' }
      },
      data: { status: 'FINISHED' }
    });

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (wallet) {
      await tx.transaction.deleteMany({ where: { walletId: wallet.id } });
      await tx.wallet.delete({ where: { userId } });
    }

    await tx.joinRequest.deleteMany({
      where: {
        userId,
        status: 'PENDING'
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        isDeleted: true,
        email: anonymousEmail,
        username: anonymousUsername,
        password: anonymousPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        displayName: `Deleted User ${userId}`,
        bio: null,
        avatarUrl: null,
        timezone: null,
        language: 'uk',
        emailVerified: false,
        updatedAt: new Date(),
      }
    });

    await tx.userStats.deleteMany({ where: { userId } });

    await markUserAsDeleted(userId);
  });

  if (user.avatarUrl?.startsWith('/uploads/')) {
    try {
      await deleteOldAvatar(user.avatarUrl);
    } catch (e) {
      logger.error({ err: e }, 'Помилка видалення аватара');
    }
  }

  logger.info(
    { userId, oldUsername: user.username, oldEmail: user.email, anonymousUsername },
    '[Security] Акаунт анонімізовано'
  );

  return true;
}

module.exports = {
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  deleteAccount,
};
