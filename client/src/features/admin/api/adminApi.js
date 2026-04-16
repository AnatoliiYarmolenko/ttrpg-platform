import api from '@/lib/axios';

// ============== СТАТИСТИКА ==============

/**
 * Отримати загальну статистику платформи
 */
export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data?.data ?? null;
};

// ============== КОРИСТУВАЧІ ==============

/**
 * Отримати список користувачів з пагінацією
 */
export const getAdminUsers = async ({ page = 1, limit = 20, search = '' } = {}) => {
  const params = new URLSearchParams({ page, limit, ...(search && { search }) });
  const response = await api.get(`/admin/users?${params}`);
  const payload = response.data?.data ?? null;

  if (!payload?.users) {
    return payload;
  }

  return {
    ...payload,
    users: payload.users.map((user) => ({
      ...user,
      _count: {
        ...user._count,
        ownedSessions: user._count?.ownedSessions ?? 0,
      },
    })),
  };
};

/**
 * Отримати деталі користувача
 */
export const getAdminUserById = async (id) => {
  const response = await api.get(`/admin/users/${id}`);
  const payload = response.data?.data ?? null;

  if (!payload) {
    return payload;
  }

  return {
    ...payload,
    _count: {
      ...payload._count,
      ownedSessions: payload._count?.ownedSessions ?? 0,
    },
  };
};

// ============== КАМПАНІЇ ==============

/**
 * Отримати список кампаній з пагінацією
 */
export const getAdminCampaigns = async ({ page = 1, limit = 20, search = '', visibility = '' } = {}) => {
  const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(visibility && { visibility }) });
  const response = await api.get(`/admin/campaigns?${params}`);
  return response.data?.data ?? null;
};

/**
 * Отримати деталі кампанії
 */
export const getAdminCampaignById = async (id) => {
  const response = await api.get(`/admin/campaigns/${id}`);
  return response.data?.data ?? null;
};

/**
 * Видалити кампанію
 */
export const deleteAdminCampaign = async (id) => {
  const response = await api.delete(`/admin/campaigns/${id}`);
  return response.data;
};

// ============== СЕСІЇ ==============

/**
 * Отримати список сесій з пагінацією
 */
export const getAdminSessions = async ({ page = 1, limit = 20, search = '', status = '' } = {}) => {
  const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(status && { status }) });
  const response = await api.get(`/admin/sessions?${params}`);
  return response.data?.data ?? null;
};

/**
 * Отримати деталі сесії
 */
export const getAdminSessionById = async (id) => {
  const response = await api.get(`/admin/sessions/${id}`);
  return response.data?.data ?? null;
};

/**
 * Видалити сесію
 */
export const deleteAdminSession = async (id) => {
  const response = await api.delete(`/admin/sessions/${id}`);
  return response.data;
};
