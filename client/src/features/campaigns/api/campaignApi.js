import api from '@/lib/axios';
import { normalizeApiEnvelope } from '@/utils/ownerCompatibility';

// === CRUD операції ===

/**
 * Створити нову кампанію
 * @param {Object} campaignData - Дані кампанії
 */
export const createCampaign = async (campaignData) => {
  const response = await api.post('/campaigns', campaignData);
  return normalizeApiEnvelope(response.data);
};

/**
 * Отримати мої кампанії
 * @param {string} [role='all'] - Фільтр по ролі: 'all' | 'owner' | 'gm' | 'player'
 */
export const getMyCampaigns = async (role = 'all') => {
  const response = await api.get('/campaigns', { params: { role } });
  return normalizeApiEnvelope(response.data);
};

/**
 * Отримати деталі кампанії
 * @param {number} campaignId
 * @param {string|null} inviteCode
 */
export const getCampaignById = async (campaignId, inviteCode = null) => {
  const params = inviteCode ? { inviteCode } : undefined;
  const response = await api.get(`/campaigns/${campaignId}`, { params });
  return normalizeApiEnvelope(response.data);
};

/**
 * Оновити кампанію
 * @param {number} campaignId
 * @param {Object} campaignData - Дані для оновлення
 */
export const updateCampaign = async (campaignId, campaignData) => {
  const response = await api.put(`/campaigns/${campaignId}`, campaignData);
  return normalizeApiEnvelope(response.data);
};

/**
 * Передати власність кампанії іншому учаснику
 * @param {number} campaignId
 * @param {number} newOwnerId
 */
export const transferCampaignOwnership = async (campaignId, newOwnerId) => {
  const response = await api.post(`/campaigns/${campaignId}/transfer-ownership`, {
    newOwnerId,
  });
  return normalizeApiEnvelope(response.data);
};

/**
 * Скасувати сесію кампанії (owner override)
 * @param {number} sessionId
 */
export const cancelCampaignSession = async (sessionId) => {
  const response = await api.post(`/sessions/${sessionId}/cancel`, {});
  return normalizeApiEnvelope(response.data);
};

/**
 * Видалити сесію кампанії (owner override)
 * @param {number} sessionId
 */
export const deleteCampaignSession = async (sessionId) => {
  const response = await api.delete(`/sessions/${sessionId}`);
  return normalizeApiEnvelope(response.data);
};

// === Управління членами ===

/**
 * Отримати членів кампанії
 * @param {number} campaignId
 */
export const getCampaignMembers = async (campaignId) => {
  const response = await api.get(`/campaigns/${campaignId}/members`);
  return normalizeApiEnvelope(response.data);
};

/**
 * Додати учасника до кампанії
 * @param {number} campaignId
 * @param {number} newMemberId - ID нового учасника
 * @param {string} [role='PLAYER'] - Роль: 'PLAYER' | 'GM'
 */
export const addMemberToCampaign = async (campaignId, newMemberId, role = 'PLAYER') => {
  const response = await api.post(`/campaigns/${campaignId}/members`, {
    newMemberId,
    role,
  });
  return normalizeApiEnvelope(response.data);
};

/**
 * Видалити учасника з кампанії
 * @param {number} campaignId
 * @param {number} memberId
 */
export const removeMemberFromCampaign = async (campaignId, memberId) => {
  const response = await api.delete(`/campaigns/${campaignId}/members/${memberId}`);
  return normalizeApiEnvelope(response.data);
};

/**
 * Оновити роль учасника
 * @param {number} campaignId
 * @param {number} memberId
 * @param {string} role - Нова роль: 'PLAYER' | 'GM'
 */
export const updateMemberRole = async (campaignId, memberId, role) => {
  const response = await api.patch(`/campaigns/${campaignId}/members/${memberId}`, {
    role,
  });
  return normalizeApiEnvelope(response.data);
};

// === Коди запрошень ===

/**
 * Перегенерувати код запрошення
 * @param {number} campaignId
 */
export const regenerateInviteCode = async (campaignId) => {
  const response = await api.post(`/campaigns/${campaignId}/invite`, {});
  return normalizeApiEnvelope(response.data);
};

/**
 * Приєднатися за кодом запрошення
 * @param {string} inviteCode
 */
export const joinByInviteCode = async (inviteCode) => {
  const response = await api.post(`/campaigns/invite/${inviteCode}`, {});
  return normalizeApiEnvelope(response.data);
};

/**
 * Отримати кампанію за invite-кодом без приєднання
 * @param {string} inviteCode
 */
export const resolveInviteCode = async (inviteCode) => {
  const response = await api.get(`/campaigns/invite/${inviteCode}`);
  return normalizeApiEnvelope(response.data);
};

// === Запити на приєднання ===

/**
 * Надіслати запит на приєднання
 * @param {number} campaignId
 * @param {string} [message=''] - Повідомлення до запиту
 */
export const submitJoinRequest = async (campaignId, message = '') => {
  const payload = message ? { message } : {};
  const response = await api.post(`/campaigns/${campaignId}/requests`, payload);
  return normalizeApiEnvelope(response.data);
};

/**
 * Отримати запити на приєднання
 * @param {number} campaignId
 */
export const getJoinRequests = async (campaignId) => {
  const response = await api.get(`/campaigns/${campaignId}/requests`);
  return normalizeApiEnvelope(response.data);
};

/**
 * Схвалити запит на приєднання
 * @param {number} requestId
 * @param {string} [role='PLAYER'] - Роль для нового учасника
 */
export const approveJoinRequest = async (requestId, role = 'PLAYER') => {
  const response = await api.post(`/campaigns/requests/${requestId}/approve`, {
    role,
  });
  return normalizeApiEnvelope(response.data);
};

/**
 * Відхилити запит на приєднання
 * @param {number} requestId
 */
export const rejectJoinRequest = async (requestId) => {
  const response = await api.post(`/campaigns/requests/${requestId}/reject`, {});
  return normalizeApiEnvelope(response.data);
};
