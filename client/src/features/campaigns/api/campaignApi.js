import api from '@/lib/axios';
import { normalizeApiEnvelope } from '@/utils/ownerCompatibility';

export const createCampaign = async (campaignData) => {
  const response = await api.post('/campaigns', campaignData);
  return normalizeApiEnvelope(response.data);
};

export const getMyCampaigns = async (role = 'all') => {
  const response = await api.get('/campaigns', { params: { role } });
  return normalizeApiEnvelope(response.data);
};

export const getCampaignById = async (campaignId) => {
  const response = await api.get(`/campaigns/${campaignId}`);
  return normalizeApiEnvelope(response.data);
};

export const getCampaignByShareToken = async (shareToken) => {
  const response = await api.get(`/campaigns/share/${shareToken}`);
  return normalizeApiEnvelope(response.data);
};

export const updateCampaign = async (campaignId, campaignData) => {
  const response = await api.put(`/campaigns/${campaignId}`, campaignData);
  return normalizeApiEnvelope(response.data);
};

export const transferCampaignOwnership = async (campaignId, newOwnerId) => {
  const response = await api.post(`/campaigns/${campaignId}/transfer-ownership`, {
    newOwnerId,
  });
  return normalizeApiEnvelope(response.data);
};

export const cancelCampaignSession = async (sessionId) => {
  const response = await api.post(`/sessions/${sessionId}/cancel`, {});
  return normalizeApiEnvelope(response.data);
};

export const deleteCampaignSession = async (sessionId) => {
  const response = await api.delete(`/sessions/${sessionId}`);
  return normalizeApiEnvelope(response.data);
};

export const getCampaignMembers = async (campaignId) => {
  const response = await api.get(`/campaigns/${campaignId}/members`);
  return normalizeApiEnvelope(response.data);
};

export const addMemberToCampaign = async (campaignId, newMemberId, role = 'PLAYER') => {
  const response = await api.post(`/campaigns/${campaignId}/members`, {
    newMemberId,
    role,
  });
  return normalizeApiEnvelope(response.data);
};

export const removeMemberFromCampaign = async (campaignId, memberId) => {
  const response = await api.delete(`/campaigns/${campaignId}/members/${memberId}`);
  return normalizeApiEnvelope(response.data);
};

export const updateMemberRole = async (campaignId, memberId, role) => {
  const response = await api.patch(`/campaigns/${campaignId}/members/${memberId}`, {
    role,
  });
  return normalizeApiEnvelope(response.data);
};

export const regenerateShareLink = async (campaignId) => {
  const response = await api.post(`/campaigns/${campaignId}/share/regenerate`, {});
  return normalizeApiEnvelope(response.data);
};

export const getCampaignShareLink = async (campaignId) => {
  const response = await api.get(`/campaigns/${campaignId}/share-link`);
  return normalizeApiEnvelope(response.data);
};

export const submitJoinRequest = async (campaignId, message = '', shareToken = null) => {
  const payload = message ? { message } : {};
  if (shareToken) payload.shareToken = shareToken;
  const response = await api.post(`/campaigns/${campaignId}/requests`, payload);
  return normalizeApiEnvelope(response.data);
};

export const getJoinRequests = async (campaignId) => {
  const response = await api.get(`/campaigns/${campaignId}/requests`);
  return normalizeApiEnvelope(response.data);
};

export const approveJoinRequest = async (requestId, role = 'PLAYER') => {
  const response = await api.post(`/campaigns/requests/${requestId}/approve`, {
    role,
  });
  return normalizeApiEnvelope(response.data);
};

export const rejectJoinRequest = async (requestId) => {
  const response = await api.post(`/campaigns/requests/${requestId}/reject`, {});
  return normalizeApiEnvelope(response.data);
};
