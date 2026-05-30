import api from '@/lib/axios';

export const getCampaignChatDescriptor = async (campaignId) => {
  const response = await api.get(`/chats/campaign/${campaignId}`);
  return response.data;
};

export const getSessionChatDescriptor = async (sessionId) => {
  const response = await api.get(`/chats/session/${sessionId}`);
  return response.data;
};

export const getChatMessages = async (chatId, params = {}) => {
  const response = await api.get(`/chats/${chatId}/messages`, { params });
  return response.data;
};

export const getChatMessagesAfter = async (chatId, after, params = {}) => {
  const response = await api.get(`/chats/${chatId}/messages`, {
    params: {
      ...params,
      after,
    },
  });
  return response.data;
};

export const getChatMessagesBefore = async (chatId, before, params = {}) => {
  const response = await api.get(`/chats/${chatId}/messages`, {
    params: {
      ...params,
      before,
    },
  });
  return response.data;
};

export const sendChatMessage = async (chatId, payload) => {
  const response = await api.post(`/chats/${chatId}/messages`, payload);
  return response.data;
};
