import api from '@/lib/axios';

/**
 * Отримати баланс віртуального гаманця поточного користувача
 * @returns {Promise<{ success: boolean, wallet: { id: number, userId: number, balance: string, createdAt: string, updatedAt: string } }>}
 */
export const getMyWallet = async () => {
  const response = await api.get('/wallet/me');
  return response.data;
};

/**
 * Отримати історію транзакцій та активні резервації гаманця
 * @param {Object} [params]
 * @param {number} [params.limit=10]
 * @param {number} [params.offset=0]
 * @returns {Promise<{
 *   success: boolean,
 *   history: Array<{ id: number, amount: string, type: string, sessionId: number|null, date: string, session: { title: string }|null }>,
 *   activeTransactions: Array<{ id: number, amount: string, type: string, sessionId: number|null, date: string }>,
 *   pagination: { total: number, limit: number, offset: number }
 * }>}
 */
export const getMyTransactions = async (params = {}) => {
  const response = await api.get('/wallet/transactions', { params });
  return response.data;
};

/**
 * Поповнити баланс гаманця Demo Coins
 * @param {Object} data
 * @param {number} data.amount - сума поповнення
 * @returns {Promise<{ success: boolean, message: string, wallet: { id: number, userId: number, balance: string } }>}
 */
export const topUpWallet = async (data) => {
  const response = await api.post('/wallet/top-up', data);
  return response.data;
};
