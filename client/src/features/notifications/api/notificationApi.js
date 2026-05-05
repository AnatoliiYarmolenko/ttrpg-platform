import api from '@/lib/axios';

export const getNotifications = async (params = {}) => {
  const response = await api.get('/notifications', { params });
  return response.data;
};

export const getUnreadCount = async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data;
};

export const markAsRead = async (notificationId) => {
  const response = await api.post(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markManyAsRead = async (ids) => {
  const response = await api.post('/notifications/read-bulk', { ids });
  return response.data;
};

export const archiveNotification = async (notificationId) => {
  const response = await api.post(`/notifications/${notificationId}/archive`);
  return response.data;
};
