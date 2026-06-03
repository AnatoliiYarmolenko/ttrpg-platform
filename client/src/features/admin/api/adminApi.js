import api from '@/lib/axios';

export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data?.data ?? null;
};


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
export const getAdminCampaigns = async ({ page = 1, limit = 20, search = '', visibility = '' } = {}) => {
  const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(visibility && { visibility }) });
  const response = await api.get(`/admin/campaigns?${params}`);
  return response.data?.data ?? null;
};
export const deleteAdminCampaign = async (id) => {
  const response = await api.delete(`/admin/campaigns/${id}`);
  return response.data;
};

export const getAdminSessions = async ({ page = 1, limit = 20, search = '', status = '' } = {}) => {
  const params = new URLSearchParams({ page, limit, ...(search && { search }), ...(status && { status }) });
  const response = await api.get(`/admin/sessions?${params}`);
  return response.data?.data ?? null;
};

export const deleteAdminSession = async (id) => {
  const response = await api.delete(`/admin/sessions/${id}`);
  return response.data;
};
