import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useChatStore from '@/stores/useChatStore';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';
import { getChatMessagesAfter, getChatMessagesBefore } from '../api/chatApi';
import {
  DEFAULT_CHAT_MESSAGES_LIMIT,
  chatMessagesQueryKeys,
  getLatestCursorFromMessages,
  buildChatCursor,
} from './useChatMessages';
import { sharedWsManager } from '@/lib/shared-ws';

const isValidId = (value) => Number.isInteger(value) && value > 0;

const createClientMessageId = () => {
  return `tmp-${crypto.randomUUID()}`;
};

export const normalizeAuthor = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username || null,
    displayName: user.displayName || user.username || null,
    avatarUrl: user.avatarUrl || user.avatar || null,
  };
};

export const isFatalChatErrorCode = (code) => {
  if (typeof code !== 'string') {
    return false;
  }

  if (code.startsWith('AUTH_') || code.startsWith('SECURITY_') || code.startsWith('ADMIN_')) {
    return true;
  }

  return code === 'CHAT_NOT_FOUND';
};

export const upsertMessageIntoList = (messages, incoming) => {
  if (!Array.isArray(messages)) {
    return [incoming];
  }

  const idx = messages.findIndex((m) => {
    if (incoming.clientMessageId && m.clientMessageId === incoming.clientMessageId) {
      return true;
    }
    
    if (incoming.id && m.id === incoming.id) {
      return true;
    }
    const isServerMessageWithoutClientTag = !incoming.clientMessageId && Number.isInteger(incoming.id);
    
    if (isServerMessageWithoutClientTag && m.pending && m.authorId === incoming.authorId && m.content === incoming.content) {
      const mTime = new Date(m.createdAt).getTime();
      const incomingTime = new Date(incoming.createdAt).getTime();
      
      if (!Number.isNaN(mTime) && !Number.isNaN(incomingTime)) {
         return Math.abs(incomingTime - mTime) < 15000;
      }
      
      return true;
    }

    return false;
  });

  if (idx !== -1) {
    const updated = [...messages];
    updated[idx] = { ...updated[idx], ...incoming, pending: false, status: 'sent' };
    return updated;
  }

  return [...messages, incoming];
};

export const mergeMessages = (messages, incomingMessages) => {
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return messages;
  }

  return incomingMessages.reduce(
    (acc, incoming) => upsertMessageIntoList(acc, incoming),
    messages || []
  );
};

export default function useChatConnection(chatId, options = {}) {
  const {
    enabled = true,
    limit = DEFAULT_CHAT_MESSAGES_LIMIT,
    lastKnownCursor = null,
  } = options;

  const queryClient = useQueryClient();
  const lastCursorRef = useRef(null);
  const catchUpInProgressRef = useRef(false);

  const user = useAuthStore(selectUser);
  const connectionState = useChatStore((s) => s.connectionState);
  const setConnectionState = useChatStore((s) => s.setConnectionState);
  const setReadonly = useChatStore((s) => s.setReadonly);
  const resetChatStore = useChatStore((s) => s.reset);
  const [capabilities, setCapabilities] = useState(null);

  const queryKey = useMemo(() => chatMessagesQueryKeys.byChat(chatId, limit), [chatId, limit]);

  const updateMessages = useCallback((updater) => {
    queryClient.setQueryData(queryKey, (old) => {
      const base = old || { messages: [], limit, total: 0 };
      const messages = updater(base.messages || []);
      const latestCursor = getLatestCursorFromMessages(messages);
      if (latestCursor) {
        lastCursorRef.current = latestCursor;
      }
      return {
        ...base,
        messages,
        total: Number.isInteger(base.total) ? Math.max(base.total, messages.length) : messages.length,
      };
    });
  }, [queryClient, queryKey, limit]);

  const upsertMessage = useCallback((incoming) => {
    updateMessages((messages) => upsertMessageIntoList(messages, incoming));
  }, [updateMessages]);

  const markOptimisticFailed = useCallback((clientMessageId) => {
    updateMessages((messages) => messages.map((item) => (
      item.clientMessageId === clientMessageId
        ? { ...item, status: 'failed', pending: false }
        : item
    )));
  }, [updateMessages]);

  const appendOptimisticMessage = useCallback((content, clientMessageId) => {
    const author = normalizeAuthor(user);
    const optimisticMessage = {
      id: clientMessageId,
      chatId,
      type: 'USER',
      content,
      authorId: author?.id || null,
      author,
      createdAt: new Date().toISOString(),
      clientMessageId,
      pending: true,
      status: 'pending',
    };

    upsertMessage(optimisticMessage);
  }, [chatId, user, upsertMessage]);

  const mergeMessagesCb = useCallback((messages, incomingMessages) => {
    return mergeMessages(messages, incomingMessages);
  }, []);

  const catchUpMessages = useCallback(async (afterCursor) => {
    if (!afterCursor || catchUpInProgressRef.current) {
      return;
    }

    catchUpInProgressRef.current = true;

    try {
      const res = await getChatMessagesAfter(chatId, afterCursor, { limit });
      if (res?.success && Array.isArray(res.data?.messages)) {
        updateMessages((messages) => mergeMessagesCb(messages, res.data.messages));
      }
    } catch (error) {
      console.warn('[Chat] Failed to catch up messages:', error);
    } finally {
      catchUpInProgressRef.current = false;
    }
  }, [chatId, limit, mergeMessagesCb, updateMessages]);

  const loadOlderMessages = useCallback(async () => {
    const currentData = queryClient.getQueryData(queryKey);
    const messages = currentData?.messages || [];
    if (messages.length === 0) return { hasMore: false };

    const earliestMessage = messages.find(m => m.id && m.createdAt);
    if (!earliestMessage) return { hasMore: false };

    const beforeCursor = buildChatCursor(earliestMessage);
    if (!beforeCursor) return { hasMore: false };

    try {
      const res = await getChatMessagesBefore(chatId, beforeCursor, { limit });
      if (res?.success && Array.isArray(res.data?.messages)) {
        const olderMessages = res.data.messages;
        
        updateMessages((prevMessages) => {
          return [...olderMessages, ...prevMessages];
        });

        return { hasMore: olderMessages.length === limit };
      }
    } catch (error) {
      console.warn('[Chat] Failed to load older messages:', error);
    }
    return { hasMore: false };
  }, [chatId, limit, queryClient, queryKey, updateMessages]);

  const handleChatJoined = useCallback((data) => {
    if (data.chatId !== chatId) return;
    setReadonly(Boolean(data.readonly));
    setCapabilities(data.capabilities || null);

    const localCursor = lastCursorRef.current;
    const snapshotCursor = data.snapshotCursor || null;
    if (localCursor && snapshotCursor && localCursor !== snapshotCursor) {
      catchUpMessages(localCursor);
    } else if (!localCursor && snapshotCursor) {
      queryClient.invalidateQueries({ queryKey });
      lastCursorRef.current = snapshotCursor;
    }
  }, [catchUpMessages, setReadonly, queryClient, queryKey, chatId]);

  const handleChatMessage = useCallback((data) => {
    if (!data.message || data.message.chatId !== chatId) return;

    upsertMessage({
      ...data.message,
      ...(data.clientMessageId ? { clientMessageId: data.clientMessageId } : {}),
    });
  }, [upsertMessage, chatId]);

  const handleChatError = useCallback((data) => {
    if (data.chatId !== chatId && data.chatId !== null) return;
    
    if (data.clientMessageId) {
      markOptimisticFailed(data.clientMessageId);
    }

    if (!isFatalChatErrorCode(data.code)) {
      return;
    }

    sharedWsManager.disconnect(true, data.message || 'Access denied to chat');
  }, [markOptimisticFailed, chatId]);

  const handleIncomingMessage = useCallback((data) => {
    if (!data || typeof data !== 'object') {
      return;
    }

    if (data.type === 'chat:joined') {
      handleChatJoined(data);
      return;
    }

    if (data.type === 'chat:message:new' && data.message) {
      handleChatMessage(data);
      return;
    }

    if (data.type === 'chat:error') {
      handleChatError(data);
    }
  }, [handleChatError, handleChatJoined, handleChatMessage]);

  const sendEvent = useCallback((type, payload) => {
    return sharedWsManager.send(type, payload);
  }, []);

  const sendMessage = useCallback((content) => {
    const trimmedContent = content?.trim();

    if (!trimmedContent) {
      return null;
    }

    if (!sharedWsManager.isConnected) {
      return null;
    }

    const clientMessageId = createClientMessageId();
    appendOptimisticMessage(trimmedContent, clientMessageId);

    sendEvent('chat:message:send', {
      chatId,
      content: trimmedContent,
      clientMessageId,
    });

    return clientMessageId;
  }, [appendOptimisticMessage, chatId, sendEvent]);

  const joinChat = useCallback(() => {
    if (!isValidId(chatId)) {
      return;
    }

    sendEvent('chat:join', {
      chatId,
      lastKnownCursor: lastCursorRef.current || undefined,
    });
  }, [chatId, sendEvent]);

  const leaveChat = useCallback(() => {
    if (!isValidId(chatId)) {
      return;
    }

    sendEvent('chat:leave', { chatId });
  }, [chatId, sendEvent]);

  useEffect(() => {
    if (lastKnownCursor) {
      lastCursorRef.current = lastKnownCursor;
    }
  }, [lastKnownCursor]);

  useEffect(() => {
    return () => {
      resetChatStore();
    };
  }, [chatId, resetChatStore]);

  const handlersRef = useRef({ handleIncomingMessage, joinChat, leaveChat, setConnectionState });
  useEffect(() => {
    handlersRef.current = { handleIncomingMessage, joinChat, leaveChat, setConnectionState };
  });

  useEffect(() => {
    if (!enabled || !isValidId(chatId)) return undefined;

    const unsubMsg = sharedWsManager.subscribeMessage((data) => {
      handlersRef.current.handleIncomingMessage(data);
    });
    
    const unsubConn = sharedWsManager.subscribeConnection((state, error) => {
      handlersRef.current.setConnectionState(state, error);
      if (state === 'connected') {
        handlersRef.current.joinChat();
      }
    });

    sharedWsManager.addRef();

    return () => {
      unsubMsg();
      unsubConn();
      handlersRef.current.leaveChat();
      sharedWsManager.removeRef();
    };
  }, [chatId, enabled]);

  useEffect(() => {
    const onFocus = () => {
      if ((connectionState === 'error' || connectionState === 'disconnected') && enabled && isValidId(chatId)) {
        sharedWsManager.connect(true);
      }
    };
    
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [chatId, enabled, connectionState]);

  return {
    connectionState,
    capabilities,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting' || connectionState === 'reconnecting',
    hasError: connectionState === 'error',
    sendMessage,
    loadOlderMessages,
    connect: () => sharedWsManager.connect(),
    disconnect: useCallback(() => { handlersRef.current.leaveChat(); sharedWsManager.removeRef(); }, []),
  };
}
