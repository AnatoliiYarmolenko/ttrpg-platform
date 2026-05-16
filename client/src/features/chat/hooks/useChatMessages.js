import { useQuery } from '@tanstack/react-query';
import { getChatMessages } from '../api/chatApi';

export const DEFAULT_CHAT_MESSAGES_LIMIT = 50;

export const chatMessagesQueryKeys = {
  byChat: (chatId, limit) => ['chat', chatId || null, 'messages', { limit }],
};

const isValidId = (value) => Number.isInteger(value) && value > 0;

export const buildChatCursor = (message) => {
  if (!message?.createdAt || !Number.isInteger(message?.id)) {
    return null;
  }

  return `${new Date(message.createdAt).toISOString()}:${message.id}`;
};

export const getLatestCursorFromMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const cursor = buildChatCursor(messages[index]);
    if (cursor) {
      return cursor;
    }
  }

  return null;
};

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

      const latestCursor = getLatestCursorFromMessages(res.data?.messages);

      return {
        ...res.data,
        latestCursor,
      };
    },
    enabled: isEnabled,
  });
}
