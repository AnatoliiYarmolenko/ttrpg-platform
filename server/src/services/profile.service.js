const { prisma } = require('../lib/prisma');
const { createError, AppError, ERROR_CODES } = require('../constants/errors');
const { PUBLIC_PROFILE_FIELDS, PRIVATE_PROFILE_FIELDS } = require('../constants/profile-fields');
const { redis } = require('../lib/redis');
const crypto = require('node:crypto');

// Поля, які можна оновлювати
const UPDATABLE_FIELDS = ['displayName', 'bio', 'timezone', 'language', 'avatarUrl'];

/**
 * Отримати власний профіль (з усіма приватними даними)
 * @param {number} userId - ID поточного користувача
 */
async function getMyProfile(userId) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: {
      ...PRIVATE_PROFILE_FIELDS,
      // Додаємо статистику
      stats: {
        select: {
          hoursPlayed: true,
          sessionsPlayed: true,
        },
      },
      // Можна додати кількість кампаній тощо
      _count: {
        select: {
          campaignsOwned: true,
          sessionsJoined: true,
        },
      },
    },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  return user;
}

/**
 * Отримати публічний профіль за username
 * @param {string} username - Username користувача
 */
async function getProfileByUsername(username) {
  const user = await prisma.user.findFirst({
    where: { 
      username,
      isDeleted: false  // Не повертаємо видалених користувачів
    },
    select: {
      ...PUBLIC_PROFILE_FIELDS,
      // Публічна статистика
      stats: {
        select: {
          hoursPlayed: true,
          sessionsPlayed: true,
        },
      },
      _count: {
        select: {
          campaignsOwned: true,
          sessionsJoined: true,
        },
      },
    },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  return user;
}

async function getProfileByUserId(userId) {
  const user = await prisma.user.findFirst({
    where: { 
      id: Number.parseInt(userId),
      isDeleted: false 
    },
    select: {
      ...PUBLIC_PROFILE_FIELDS,
      stats: {
        select: {
          hoursPlayed: true,
          sessionsPlayed: true,
        },
      },
      _count: {
        select: {
          campaignsOwned: true,
          sessionsJoined: true,
        },
      },
    },
  });

  if (!user) {
    throw createError.userNotFound();
  }

  return user;
}

/**
 * Оновити профіль користувача
 * @param {number} userId - ID користувача
 * @param {object} data - Дані для оновлення
 */
async function updateProfile(userId, data) {
  // Фільтруємо тільки дозволені поля
  const updateData = {};
  for (const field of UPDATABLE_FIELDS) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Немає даних для оновлення');
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: PRIVATE_PROFILE_FIELDS,
  });

  return updatedUser;
}

/**
 * Оновити username (окрема функція через унікальність)
 * @param {number} userId - ID користувача
 * @param {string} newUsername - Новий username
 */
async function updateUsername(userId, newUsername) {
  // Перевіряємо, чи username вже зайнятий
  const existing = await prisma.user.findUnique({
    where: { username: newUsername },
  });

  if (existing && existing.id !== userId) {
    throw createError.usernameTaken();
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { username: newUsername },
    select: PRIVATE_PROFILE_FIELDS,
  });

  return updatedUser;
}

/**
 * Оновити час останнього візиту
 * @param {number} userId - ID користувача
 */
async function updateLastActive(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveAt: new Date() },
  });
}

/**
 * Оновити аватар користувача
 * @param {number} userId - ID користувача
 * @param {string} avatarUrl - URL нового аватара
 * @returns {Promise<Object>} - Оновлений профіль
 */
async function updateAvatar(userId, avatarUrl) {
  // Отримуємо поточний аватар для видалення
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
    select: PRIVATE_PROFILE_FIELDS,
  });

  // Повертаємо і старий URL для видалення файлу
  return { 
    profile: updatedUser, 
    oldAvatarUrl: currentUser?.avatarUrl 
  };
}

/**
 * Видалити аватар користувача
 * @param {number} userId - ID користувача
 * @returns {Promise<Object>} - Оновлений профіль та старий URL
 */
async function deleteAvatar(userId) {
  // Отримуємо поточний аватар для видалення файлу
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: PRIVATE_PROFILE_FIELDS,
  });

  return { 
    profile: updatedUser, 
    oldAvatarUrl: currentUser?.avatarUrl 
  };
}

/**
 * Генерує токен для прив'язки Telegram
 * @param {number} userId - ID користувача
 * @returns {Promise<string>} - Згенерований токен
 */
async function generateTelegramLinkToken(userId) {
  const token = crypto.randomBytes(16).toString('hex');
  const redisKey = `telegram_link:${token}`;
  
  // Зберігаємо на 10 хвилин (600 секунд)
  await redis.set(redisKey, userId.toString(), 'EX', 600);
  
  return token;
}

/**
 * Відв'язує Telegram від акаунту
 * @param {number} userId - ID користувача
 */
async function unlinkTelegram(userId) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramLinkedAt: null,
      },
    });

    const pref = await tx.notificationPreference.findUnique({
      where: { userId },
    });

    if (pref?.enabledChannels) {
      let channels = pref.enabledChannels || [];
      if (!Array.isArray(channels)) {
        channels = [];
      }
      
      const newChannels = channels.filter(c => c !== 'TELEGRAM');
      
      await tx.notificationPreference.update({
        where: { userId },
        data: { enabledChannels: newChannels },
      });
    }
  });
}

/**
 * Прив'язує Telegram за токеном
 * @param {string} token - Згенерований токен
 * @param {number|string} chatId - ID чату Telegram
 * @returns {Promise<boolean>} - Успішність операції
 */
async function linkTelegram(token, chatId) {
  const redisKey = `telegram_link:${token}`;
  const userIdStr = await redis.get(redisKey);
  
  if (!userIdStr) {
    return false; // Токен не знайдено або прострочено
  }
  
  const userId = Number.parseInt(userIdStr, 10);
  
  await prisma.$transaction(async (tx) => {
    // 1. Прив'язуємо чат
    await tx.user.update({
      where: { id: userId },
      data: {
        telegramChatId: chatId.toString(),
        telegramLinkedAt: new Date(),
      },
    });

    // 2. Вмикаємо TELEGRAM у налаштуваннях нотифікацій
    const pref = await tx.notificationPreference.findUnique({
      where: { userId },
    });

    if (pref) {
      let channels = pref.enabledChannels || [];
      if (!Array.isArray(channels)) channels = [];
      if (!channels.includes('TELEGRAM')) {
        channels.push('TELEGRAM');
        await tx.notificationPreference.update({
          where: { userId },
          data: { enabledChannels: channels },
        });
      }
    } else {
      await tx.notificationPreference.create({
        data: {
          userId,
          enabledChannels: ['TELEGRAM'],
        }
      });
    }
  });
  
  // Видаляємо токен
  await redis.del(redisKey);
  
  return true;
}

/**
 * Відв'язує Telegram за Chat ID (наприклад, по команді /stop)
 * @param {number|string} chatId - ID чату Telegram
 */
async function unlinkTelegramByChatId(chatId) {
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId.toString() },
  });
  
  if (user) {
    await unlinkTelegram(user.id);
  }
}

module.exports = {
  getMyProfile,
  getProfileByUsername,
  getProfileByUserId,
  updateProfile,
  updateUsername,
  updateLastActive,
  updateAvatar,
  deleteAvatar,
  generateTelegramLinkToken,
  unlinkTelegram,
  linkTelegram,
  unlinkTelegramByChatId,
};
