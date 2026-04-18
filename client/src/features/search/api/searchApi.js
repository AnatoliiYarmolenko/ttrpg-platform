import api from '@/lib/axios';

/**
 * Пошук публічних кампаній
 * @param {Object} params - Параметри пошуку
 * @param {string} [params.q] - Пошуковий запит
 * @param {string} [params.system] - Фільтр по системі
 * @param {number} [params.limit] - Кількість результатів
 * @param {number} [params.offset] - Offset для пагінації
 * @param {string} [params.sortBy] - 'newest' | 'popular' | 'title'
 */
export const searchCampaigns = async (params = {}) => {
  const response = await api.get('/search/campaigns', { params });
  return response.data;
};

/**
 * Пошук публічних сесій
 * @param {Object} params - Параметри пошуку
 * @param {string} [params.q] - Пошуковий запит
 * @param {string} [params.system] - Фільтр по системі
 * @param {string} [params.dateFrom] - Дата від (ISO8601)
 * @param {string} [params.dateTo] - Дата до (ISO8601)
 * @param {number} [params.minPrice] - Мінімальна ціна
 * @param {number} [params.maxPrice] - Максимальна ціна
 * @param {boolean} [params.hasAvailableSlots] - Тільки з вільними місцями
 * @param {boolean} [params.oneShot] - Тільки one-shot
 * @param {number} [params.limit] - Кількість результатів
 * @param {number} [params.offset] - Offset для пагінації
 * @param {string} [params.sortBy] - 'date' | 'price' | 'newest'
 */
export const searchSessions = async (params = {}) => {
  const response = await api.get('/search/sessions', { params });
  return response.data;
};
