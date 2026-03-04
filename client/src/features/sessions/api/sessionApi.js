import api from '@/lib/axios';

// === CRUD Сесії ===

/**
 * Створити нову сесію
 * @param {Object} sessionData - Дані сесії
 */
export const createSession = async (sessionData) => {
  const response = await api.post('/sessions', sessionData);
  return response.data;
};

/**
 * Отримати мої сесії
 * @param {Object} params - Параметри фільтрації
 * @param {string} [params.status] - PLANNED | ACTIVE | FINISHED | CANCELED
 * @param {string} [params.role] - GM | PLAYER | ALL
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
export const getMySessions = async (params = {}) => {
  const response = await api.get('/sessions', { params });
  return response.data;
};

/**
 * Отримати деталі сесії
 * @param {number} sessionId
 */
export const getSessionById = async (sessionId) => {
  const response = await api.get(`/sessions/${sessionId}`);
  return response.data;
};

/**
 * Оновити сесію
 * @param {number} sessionId
 * @param {Object} sessionData - Дані для оновлення
 */
export const updateSession = async (sessionId, sessionData) => {
  const response = await api.patch(`/sessions/${sessionId}`, sessionData);
  return response.data;
};

/**
 * Видалити (скасувати) сесію
 * @param {number} sessionId
 */
export const deleteSession = async (sessionId) => {
  const response = await api.delete(`/sessions/${sessionId}`);
  return response.data;
};

/**
 * Скасувати сесію (soft delete)
 * @param {number} sessionId
 */
export const cancelSession = async (sessionId) => {
  const response = await api.post(`/sessions/${sessionId}/cancel`);
  return response.data;
};

/**
 * Позначити сесію як проведену
 * @param {number} sessionId
 */
export const markSessionAsFinished = async (sessionId) => {
  const response = await api.post(`/sessions/${sessionId}/mark-finished`);
  return response.data;
};

// === Календар ===

/**
 * Отримати агрегацію для календаря
 * @param {Object} params
 * @param {number} [params.year]
 * @param {number} [params.month]
 * @param {string} [params.type] - MY | PUBLIC | ALL
 */
export const getCalendar = async (params = {}) => {
  const response = await api.get('/sessions/calendar', { params });
  return response.data;
};

/**
 * Отримати статистику календаря з фільтрами (новий API для Dashboard)
 * @param {Object} params
 * @param {string} [params.month] - ISO дата місяця (YYYY-MM-DD)
 * @param {string} [params.scope] - 'global' | 'user' | 'search'
 * @param {Object} [params.filters] - Об'єкт з фільтрами для пошуку
 */
export const getCalendarStats = async (params = {}) => {
  const { filters, ...rest } = params;
  const queryParams = {
    ...rest,
    ...(filters && { filters: JSON.stringify(filters) }),
  };
  const response = await api.get('/sessions/calendar-stats', { params: queryParams });
  return response.data;
};

/**
 * Отримати сесії конкретного дня
 * @param {string} date - Дата у форматі YYYY-MM-DD
 * @param {Object} [params] - Додаткові параметри
 */
export const getSessionsByDay = async (date, params = {}) => {
  const response = await api.get(`/sessions/day/${date}`, { params });
  return response.data;
};

/**
 * Отримати сесії конкретного дня з фільтрами (новий API для Dashboard)
 * @param {string} date - Дата у форматі YYYY-MM-DD
 * @param {string} [scope] - 'global' | 'user' | 'search'
 * @param {Object} [filters] - Об'єкт з фільтрами для пошуку
 */
export const getSessionsByDayFiltered = async (date, scope = 'global', filters = null) => {
  const params = { scope };
  if (filters) {
    params.filters = JSON.stringify(filters);
  }
  const response = await api.get(`/sessions/day-filtered/${date}`, { params });
  return response.data;
};

/**
 * Отримати сесії кампанії
 * @param {number} campaignId
 * @param {Object} [params] - Параметри фільтрації
 */
export const getCampaignSessions = async (campaignId, params = {}) => {
  const response = await api.get(`/campaigns/${campaignId}/sessions`, { params });
  return response.data;
};

// === Учасники сесії ===

/**
 * Отримати учасників сесії
 * @param {number} sessionId
 */
export const getSessionParticipants = async (sessionId) => {
  const response = await api.get(`/sessions/${sessionId}/participants`);
  return response.data;
};

/**
 * Приєднатися до сесії
 * @param {number} sessionId
 */
export const joinSession = async (sessionId, payload = {}) => {
  const response = await api.post(`/sessions/${sessionId}/join`, payload);
  return response.data;
};

/**
 * Вийти з сесії
 * @param {number} sessionId
 */
export const leaveSession = async (sessionId) => {
  const response = await api.post(`/sessions/${sessionId}/leave`, {});
  return response.data;
};

/**
 * Оновити статус учасника (для GM)
 * @param {number} sessionId
 * @param {number} participantId
 * @param {string} status - PENDING | CONFIRMED | DECLINED | ATTENDED | NO_SHOW
 */
export const updateParticipantStatus = async (sessionId, participantId, status) => {
  const response = await api.patch(
    `/sessions/${sessionId}/participants/${participantId}`,
    { status }
  );
  return response.data;
};

/**
 * Видалити учасника з сесії (для GM)
 * @param {number} sessionId
 * @param {number} participantId
 */
export const removeParticipant = async (sessionId, participantId) => {
  const response = await api.delete(
    `/sessions/${sessionId}/participants/${participantId}`
  );
  return response.data;
};
