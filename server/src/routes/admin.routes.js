/**
 * Admin Routes
 * Маршрути для адміністративних функцій
 * Всі маршрути потребують автентифікації + ролі ADMIN
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { requireAdmin } = require('../middlewares/admin.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');

// Всі admin routes потребують автентифікації + перевірки ролі адміністратора
router.use(authenticateToken);
router.use(requireAdmin);

// ========== СТАТИСТИКА ==========

/**
 * GET /api/admin/stats
 * Загальна статистика платформи (користувачі, кампанії, сесії)
 */
router.get('/stats', adminController.getStats);

// ========== TOKEN MANAGEMENT ==========

/**
 * GET /api/admin/token-stats
 * Статистика по refresh токенам
 */
router.get('/token-stats', adminController.getTokenStats);

/**
 * POST /api/admin/cleanup-tokens
 * Ручна очистка прострочених токенів
 */
router.post('/cleanup-tokens', verifyCSRFToken, adminController.cleanupTokens);

// ========== USER MANAGEMENT ==========

/**
 * GET /api/admin/users
 * Список користувачів з пагінацією та пошуком
 * Query: ?page=1&limit=20&search=
 */
router.get('/users', adminController.getUsers);

/**
 * GET /api/admin/users/:id
 * Деталі конкретного користувача
 */
router.get('/users/:id', adminController.getUserById);

// ========== CAMPAIGN MANAGEMENT ==========

/**
 * GET /api/admin/campaigns
 * Список кампаній з пагінацією, пошуком та фільтрами
 * Query: ?page=1&limit=20&search=&visibility=PUBLIC|PRIVATE|LINK_ONLY
 */
router.get('/campaigns', adminController.getCampaigns);

/**
 * GET /api/admin/campaigns/:id
 * Деталі кампанії
 */
router.get('/campaigns/:id', adminController.getCampaignById);

/**
 * DELETE /api/admin/campaigns/:id
 * Видалення кампанії адміністратором
 */
router.delete('/campaigns/:id', verifyCSRFToken, adminController.deleteCampaign);

// ========== SESSION MANAGEMENT ==========

/**
 * GET /api/admin/sessions
 * Список сесій з пагінацією, пошуком та фільтрами
 * Query: ?page=1&limit=20&search=&status=PLANNED|ACTIVE|FINISHED|CANCELED
 */
router.get('/sessions', adminController.getSessions);

/**
 * GET /api/admin/sessions/:id
 * Деталі сесії
 */
router.get('/sessions/:id', adminController.getSessionById);

/**
 * DELETE /api/admin/sessions/:id
 * Видалення сесії адміністратором
 */
router.delete('/sessions/:id', verifyCSRFToken, adminController.deleteSession);

module.exports = router;
