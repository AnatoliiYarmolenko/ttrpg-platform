import { useQuery } from '@tanstack/react-query';
import { getChatMessages } from '../api/chatApi';

export const DEFAULT_CHAT_MESSAGES_LIMIT = 50;

export const chatMessagesQueryKeys = {
  byChat: (chatId, limit) => ['chat', chatId || null, 'messages', { limit }],
};

const isValidId = (value) => Number.isInteger(value) && value > 0;

export default function useChatMessages(chatId, options = {}) {
  const { limit = DEFAULT_CHAT_MESSAGES_LIMIT, enabled = true } = options;
  const isEnabled = enabled && isValidId(chatId);

  return useQuery({
    queryKey: chatMessagesQueryKeys.byChat(chatId, limit),
    queryFn: async () => {
      const res = await getChatMessages(chatId, { limit });

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch chat messages');
      }

      return res.data;
    },
    enabled: isEnabled,
  });
}
