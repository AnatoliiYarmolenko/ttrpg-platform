const express = require('express');
const router = express.Router();
const searchController = require('../controllers/search.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

const {
  validateSearchCampaigns,
  validateSearchSessions,
} = require('../validation/search.validation');

// === Маршрути пошуку ===
// Пошук доступний лише авторизованим користувачам платформи

/**
 * Пошук публічних кампаній
 * GET /api/search/campaigns
 * 
 * Query params:
 * - q: Пошуковий запит (по назві/опису)
 * - system: Фільтр по системі (D&D 5e, Pathfinder тощо)
 * - limit: Кількість результатів (1-50, default: 20)
 * - offset: Offset для пагінації
 * - sortBy: 'newest' | 'popular' | 'title'
 */
router.get(
  '/campaigns',
  [authenticateToken, ...validateSearchCampaigns],
  (req, res, next) => searchController.searchCampaigns(req, res, next)
);

/**
 * Пошук публічних сесій
 * GET /api/search/sessions
 * 
 * Query params:
 * - q: Пошуковий запит (по назві/опису)
 * - system: Фільтр по системі (через кампанію)
 * - dateFrom: Дата від (ISO8601)
 * - dateTo: Дата до (ISO8601)
 * - minPrice: Мінімальна ціна
 * - maxPrice: Максимальна ціна
 * - hasAvailableSlots: Тільки з вільними місцями (true/false)
 * - oneShot: Тільки one-shot (true/false)
 * - limit: Кількість результатів (1-50, default: 20)
 * - offset: Offset для пагінації
 * - sortBy: 'date' | 'price' | 'newest'
 */
router.get(
  '/sessions',
  [authenticateToken, ...validateSearchSessions],
  (req, res, next) => searchController.searchSessions(req, res, next)
);

module.exports = router;
