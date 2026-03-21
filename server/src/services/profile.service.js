const { prisma } = require('../lib/prisma');
const { createError, AppError, ERROR_CODES } = require('../constants/errors');

// Поля, які можна повертати публічно
const PUBLIC_PROFILE_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  createdAt: true,
};

// Поля для власного профілю (включає приватні дані)
const PRIVATE_PROFILE_FIELDS = {
  ...PUBLIC_PROFILE_FIELDS,
  email: true,
  role: true,
  timezone: true,
  language: true,
  lastActiveAt: true,
  updatedAt: true,
  emailVerified: true,
};

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
      id: parseInt(userId),
      isDeleted: false  // Не повертаємо видалених користувачів
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

module.exports = {
  getMyProfile,
  getProfileByUsername,
  getProfileByUserId,
  updateProfile,
  updateUsername,
  updateLastActive,
  updateAvatar,
  deleteAvatar,
};
