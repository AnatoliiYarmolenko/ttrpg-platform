import api from '@/lib/axios';

/**
 * Отримати власний профіль (з приватними даними)
 */
export const getMyProfile = async () => {
  const response = await api.get('/profile/me');
  return response.data;
};

/**
 * Отримати публічний профіль за username
 * @param {string} username
 * @returns {Promise<{ profile: import('../profileModel').ProfileShape }>}
 */
export const getProfileByUsername = async (username) => {
  const response = await api.get(`/profile/${username}`);
  return response.data;
};

/**
 * Отримати публічний профіль за userId
 * @param {number} userId
 * @returns {Promise<{ profile: import('../profileModel').ProfileShape }>}
 */
export const getProfileByUserId = async (userId) => {
  const response = await api.get(`/profile/user/${userId}`);
  return response.data;
};

/**
 * Оновити профіль
 * @param {Object} data - { displayName?, bio?, timezone?, language?, avatarUrl? }
 */
export const updateProfile = async (data) => {
  const response = await api.patch('/profile/me', data);
  return response.data;
};

/**
 * Оновити username
 * @param {string} username - новий username
 */
export const updateUsername = async (username) => {
  const response = await api.patch('/profile/me/username', { username });
  return response.data;
};

/**
 * Видалити аватар
 */
export const deleteAvatar = async () => {
  const response = await api.delete('/profile/me/avatar');
  return response.data;
};

/**
 * Завантажити аватар (буде реалізовано пізніше з S3/Cloudinary)
 * @param {File} file - файл зображення
 */
export const uploadAvatar = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);
  
  const response = await api.post('/profile/me/avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

/**
 * Отримати токен для прив'язки Telegram
 */
export const getTelegramLinkToken = async () => {
  const response = await api.get('/profile/telegram/link');
  return response.data;
};

/**
 * Відв'язати Telegram
 */
export const unlinkTelegram = async () => {
  const response = await api.delete('/profile/telegram/link');
  return response.data;
};
