const multer = require('multer');
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');
const fsPromises = require('node:fs/promises');
const crypto = require('node:crypto');
const { createError } = require('../constants/errors');
const { logger } = require('../lib/logger');

// Папка для зберігання аватарів та карт
const UPLOAD_DIR = path.join(__dirname, '../../uploads/avatars');
const MAPS_UPLOAD_DIR = path.join(__dirname, '../../uploads/maps');

// Створюємо папки якщо не існують
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(MAPS_UPLOAD_DIR)) {
  fs.mkdirSync(MAPS_UPLOAD_DIR, { recursive: true });
}

// Налаштування для аватарів
const AVATAR_CONFIG = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  outputSize: 256, // Розмір вихідного зображення (256x256)
  quality: 85, // Якість JPEG/WebP
};

// Налаштування для карт
const MAP_CONFIG = {
  maxSize: 15 * 1024 * 1024, // 15MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxDimension: 4096, // Максимальна ширина або висота
  quality: 80,
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
 * Налаштований multer для карт
 */
const mapUploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAP_CONFIG.maxSize,
  },
}).single('map'); // Поле форми називається 'map'

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
 * Обробляє та зберігає карту
 * @param {Buffer} buffer - Буфер зображення
 * @param {number|string} sessionId - ID сесії
 * @returns {Promise<{url: string, width: number, height: number}>} - URL та розміри карти
 */
async function processAndSaveMap(buffer, sessionId) {
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(4).toString('hex');
  const fileName = `map_${sessionId}_${timestamp}_${randomStr}.webp`;
  const filePath = path.join(MAPS_UPLOAD_DIR, fileName);

  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  let { width, height } = metadata;
  
  // Якщо зображення більше за дозволений розмір, зменшуємо його пропорційно
  if (width > MAP_CONFIG.maxDimension || height > MAP_CONFIG.maxDimension) {
    if (width > height) {
      height = Math.round((height * MAP_CONFIG.maxDimension) / width);
      width = MAP_CONFIG.maxDimension;
    } else {
      width = Math.round((width * MAP_CONFIG.maxDimension) / height);
      height = MAP_CONFIG.maxDimension;
    }
  }

  await image
    .resize(width, height)
    .webp({ quality: MAP_CONFIG.quality })
    .toFile(filePath);

  return {
    url: `/uploads/maps/${fileName}`,
    width,
    height,
  };
}

/**
 * Видаляє старий аватар з файлової системи
 * @param {string} avatarUrl - URL старого аватара
 */
async function deleteOldAvatar(avatarUrl) {
  if (!avatarUrl?.startsWith('/uploads/avatars/')) {
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
  mapUploadMiddleware,
  processAndSaveAvatar,
  processAndSaveMap,
  deleteOldAvatar,
  handleMulterError,
  UPLOAD_DIR,
  MAPS_UPLOAD_DIR,
  AVATAR_CONFIG,
  MAP_CONFIG,
};
