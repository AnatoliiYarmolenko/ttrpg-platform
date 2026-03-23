const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const crypto = require('crypto');
const { createError } = require('../constants/errors');
const { logger } = require('../lib/logger');

// Папка для зберігання аватарів
const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');

// Створюємо папку якщо не існує
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Налаштування для аватарів
const AVATAR_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  outputSize: 256, // Розмір вихідного зображення (256x256)
  quality: 85, // Якість JPEG
};

/**
 * Генерує унікальне ім'я файлу
 */
function generateFileName(userId, extension) {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  return `avatar_${userId}_${timestamp}_${randomStr}${extension}`;
}

/**
 * Multer storage - зберігаємо в пам'яті для обробки Sharp
 */
const storage = multer.memoryStorage();

/**
 * Фільтр для перевірки типу файлу
 */
const fileFilter = (req, file, cb) => {
  if (AVATAR_CONFIG.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(createError.fileInvalidFormat('JPG, PNG, GIF, WebP'), false);
  }
};

/**
 * Налаштований multer для аватарів
 */
const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: AVATAR_CONFIG.maxSize,
  },
}).single('avatar'); // Поле форми називається 'avatar'

/**
 * Обробляє та зберігає аватар
 * @param {Buffer} buffer - Буфер зображення
 * @param {number} userId - ID користувача
 * @returns {Promise<string>} - URL аватара
 */
async function processAndSaveAvatar(buffer, userId) {
  const fileName = generateFileName(userId, '.webp');
  const filePath = path.join(UPLOAD_DIR, fileName);

  // Обробляємо зображення за допомогою Sharp
  await sharp(buffer)
    .resize(AVATAR_CONFIG.outputSize, AVATAR_CONFIG.outputSize, {
      fit: 'cover', // Обрізаємо до квадрату
      position: 'center',
    })
    .webp({ quality: AVATAR_CONFIG.quality }) // Конвертуємо в WebP
    .toFile(filePath);

  // Повертаємо відносний URL для збереження в БД
  return `/uploads/avatars/${fileName}`;
}

/**
 * Видаляє старий аватар з файлової системи
 * @param {string} avatarUrl - URL старого аватара
 */
async function deleteOldAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) {
    return; // Не видаляємо зовнішні URL або пусті значення
  }

  const fileName = path.basename(avatarUrl);
  const filePath = path.join(UPLOAD_DIR, fileName);

  try {
    await fsPromises.unlink(filePath);
    logger.info({ fileName }, '[Upload] Видалено старий аватар');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }

    logger.error({ err: error }, '[Upload] Помилка видалення аватара');
  }
}

/**
 * Middleware для обробки помилок multer
 */
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `Файл занадто великий. Максимум: ${AVATAR_CONFIG.maxSize / 1024 / 1024}MB` 
      });
    }
    return res.status(400).json({ error: `Помилка завантаження: ${err.message}` });
  }
  
  if (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  
  next();
}

module.exports = {
  uploadMiddleware,
  processAndSaveAvatar,
  deleteOldAvatar,
  handleMulterError,
  UPLOAD_DIR,
  AVATAR_CONFIG,
};
