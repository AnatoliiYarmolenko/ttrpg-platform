const searchService = require('../services/search.service');

function normalizeBooleanFlag(value) {
  return value === true || value === 'true';
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isNaN(parsedValue) ? undefined : parsedValue;
}

/**
 * SearchController — контролер для пошуку для авторизованих користувачів
 */
class SearchController {
  /**
   * Пошук кампаній, доступних поточному користувачу
   * GET /api/search/campaigns
   * 
   * Query params:
   * @param {string} q - Пошуковий запит (по назві/опису)
   * @param {string} system - Фільтр по системі
   * @param {number} limit - Кількість результатів (default: 20, max: 50)
   * @param {number} offset - Offset для пагінації
   * @param {string} sortBy - 'newest' | 'popular' | 'title'
   */
  async searchCampaigns(req, res, next) {
    try {
      const { 
        q: query, 
        system, 
        ownerUsername,
        onlyMyParticipation,
        limit = 20, 
        offset = 0, 
        sortBy = 'newest' 
      } = req.query;

      const result = await searchService.searchCampaigns({
        userId: req.user.id,
        query,
        system,
        ownerUsername,
        onlyMyParticipation: normalizeBooleanFlag(onlyMyParticipation),
        limit: Math.min(Number.parseInt(limit, 10) || 20, 50), // Max 50
        offset: Number.parseInt(offset, 10) || 0,
        sortBy,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
    * Пошук сесій, доступних поточному користувачу
   * GET /api/search/sessions
   * 
   * Query params:
   * @param {string} q - Пошуковий запит (по назві/опису)
   * @param {string} system - Фільтр по системі (через кампанію)
   * @param {string} dateFrom - Дата від (ISO8601)
   * @param {string} dateTo - Дата до (ISO8601)
   * @param {number} minPrice - Мінімальна ціна
   * @param {number} maxPrice - Максимальна ціна
   * @param {boolean} hasAvailableSlots - Тільки з вільними місцями
   * @param {boolean} oneShot - Тільки one-shot
   * @param {number} limit - Кількість результатів (default: 20, max: 50)
   * @param {number} offset - Offset для пагінації
   * @param {string} sortBy - 'date' | 'price' | 'newest'
   */
  async searchSessions(req, res, next) {
    try {
      const {
        q: query,
        system,
        ownerUsername,
        onlyMyParticipation,
        dateFrom,
        dateTo,
        minPrice,
        maxPrice,
        hasAvailableSlots,
        oneShot,
        limit = 20,
        offset = 0,
        sortBy = 'date',
      } = req.query;

      const result = await searchService.searchSessions({
        userId: req.user.id,
        query,
        system,
        ownerUsername,
        onlyMyParticipation: normalizeBooleanFlag(onlyMyParticipation),
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        minPrice: parseOptionalNumber(minPrice),
        maxPrice: parseOptionalNumber(maxPrice),
        hasAvailableSlots: normalizeBooleanFlag(hasAvailableSlots),
        oneShot: normalizeBooleanFlag(oneShot),
        limit: Math.min(Number.parseInt(limit, 10) || 20, 50), // Max 50
        offset: Number.parseInt(offset, 10) || 0,
        sortBy,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SearchController();
