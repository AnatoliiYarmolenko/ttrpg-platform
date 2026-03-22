const profileService = require('../services/profile.service');
const { processAndSaveAvatar, deleteOldAvatar } = require('../services/upload.service');
const { logger } = require('../lib/logger');

class ProfileController {
  /**
   * GET /api/profile/me
   * Отримати власний профіль
   */
  async getMyProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const profile = await profileService.getMyProfile(userId);
      
      // Оновлюємо lastActiveAt у фоні (не чекаємо)
      profileService.updateLastActive(userId).catch((err) => {
        logger.error({ err, userId }, 'Не вдалося оновити lastActive');
      });
      
      res.json({ success: true, profile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/profile/:username
   * Отримати публічний профіль за username
   */
  async getProfileByUsername(req, res, next) {
    try {
      const { username } = req.params;
      const profile = await profileService.getProfileByUsername(username);
      
      res.json({ success: true, profile });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/profile/me
   * Оновити власний профіль
   */
  async updateProfile(req, res, next) {
    try {
      const userId = req.user.id;
      const updateData = req.body;
      
      const updatedProfile = await profileService.updateProfile(userId, updateData);
      
      res.json({ 
        success: true, 
        message: 'Профіль успішно оновлено',
        profile: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/profile/me/username
   * Оновити username (окремий endpoint для безпеки)
   */
  async updateUsername(req, res, next) {
    try {
      const userId = req.user.id;
      const { username } = req.body;
      
      const updatedProfile = await profileService.updateUsername(userId, username);
      
      res.json({ 
        success: true, 
        message: 'Username успішно змінено',
        profile: updatedProfile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/profile/me/avatar
   * Завантажити новий аватар
   */
  async uploadAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Перевіряємо чи файл завантажено
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          error: 'Файл не завантажено' 
        });
      }

      // Обробляємо та зберігаємо аватар
      const avatarUrl = await processAndSaveAvatar(req.file.buffer, userId);
      
      // Оновлюємо профіль в БД
      const { profile, oldAvatarUrl } = await profileService.updateAvatar(userId, avatarUrl);
      
      // Видаляємо старий файл у фоні
      if (oldAvatarUrl) {
        deleteOldAvatar(oldAvatarUrl);
      }
      
      res.json({ 
        success: true, 
        message: 'Аватар успішно завантажено',
        profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/profile/me/avatar
   * Видалити аватар
   */
  async deleteAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      const { profile, oldAvatarUrl } = await profileService.deleteAvatar(userId);
      
      // Видаляємо файл у фоні
      if (oldAvatarUrl) {
        deleteOldAvatar(oldAvatarUrl);
      }
      
      res.json({ 
        success: true, 
        message: 'Аватар видалено',
        profile,
      });
    } catch (error) {
      next(error);
    }
  }
  /**
   * GET /api/profile/user/:id
   * Отримати публічний профіль за userId
   */
  async getProfileByUserId(req, res, next) {
    try {
      const { id } = req.params;
      const profile = await profileService.getProfileByUserId(id);
      res.json({ success: true, profile });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProfileController();
