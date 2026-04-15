/**
 * Admin Controller
 * Обробляє адміністративні запити
 * Всі ендпоінти захищені middleware authenticateToken + requireAdmin
 */

const tokenCleanupService = require('../services/token-cleanup.service');
const adminService = require('../services/admin.service');
const { AppError, ERROR_CODES } = require('../constants/errors');

class AdminController {
  // ============== СТАТИСТИКА ==============

  /**
   * GET /api/admin/stats
   * Загальна статистика платформи
   */
  async getStats(req, res, next) {
    try {
      const stats = await adminService.getStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  // ============== TOKEN MANAGEMENT ==============

  /**
   * GET /api/admin/token-stats
   * Статистика по refresh токенам
   */
  async getTokenStats(req, res, next) {
    try {
      const stats = await tokenCleanupService.getTokenStats();
      res.json({
        success: true,
        data: stats,
        message: 'Статистика по refresh токенам отримана',
      });
    } catch (error) {
      next(new AppError(ERROR_CODES.SERVER_ERROR, 'Помилка отримання статистики', { originalError: error.message }));
    }
  }

  /**
   * POST /api/admin/cleanup-tokens
   * Ручна очистка прострочених токенів
   */
  async cleanupTokens(req, res, next) {
    try {
      const result = await tokenCleanupService.performFullCleanup();
      res.json({
        success: true,
        data: result,
        message: 'Очистка токенів виконана успішно',
      });
    } catch (error) {
      next(new AppError(ERROR_CODES.SERVER_ERROR, 'Помилка при очистці токенів', { originalError: error.message }));
    }
  }

  // ============== КОРИСТУВАЧІ ==============

  /**
   * GET /api/admin/users
   * Список користувачів з пагінацією та пошуком
   */
  async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const result = await adminService.getUsers({
        page: parseInt(page),
        limit: Math.min(parseInt(limit) || 20, 100),
        search: search.trim(),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/users/:id
   * Деталі конкретного користувача
   */
  async getUserById(req, res, next) {
    try {
      const user = await adminService.getUserById(req.params.id);
      res.json({ success: true, data: user });
    } catch (error) {
      next(error);
    }
  }

  // ============== КАМПАНІЇ ==============

  /**
   * GET /api/admin/campaigns
   * Список кампаній з пагінацією, пошуком та фільтрами
   */
  async getCampaigns(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '', visibility = '' } = req.query;
      const result = await adminService.getCampaigns({
        page: parseInt(page),
        limit: Math.min(parseInt(limit) || 20, 100),
        search: search.trim(),
        visibility,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/campaigns/:id
   * Деталі кампанії
   */
  async getCampaignById(req, res, next) {
    try {
      const campaign = await adminService.getCampaignById(req.params.id);
      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/campaigns/:id
   * Видалення кампанії
   */
  async deleteCampaign(req, res, next) {
    try {
      const result = await adminService.deleteCampaign(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  // ============== СЕСІЇ ==============

  /**
   * GET /api/admin/sessions
   * Список сесій з пагінацією, пошуком та фільтрами
   */
  async getSessions(req, res, next) {
    try {
      const { page = 1, limit = 20, search = '', status = '' } = req.query;
      const result = await adminService.getSessions({
        page: parseInt(page),
        limit: Math.min(parseInt(limit) || 20, 100),
        search: search.trim(),
        status,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/admin/sessions/:id
   * Деталі сесії
   */
  async getSessionById(req, res, next) {
    try {
      const session = await adminService.getSessionById(req.params.id);
      res.json({ success: true, data: session });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/admin/sessions/:id
   * Видалення сесії
   */
  async deleteSession(req, res, next) {
    try {
      const result = await adminService.deleteSession(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
