import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useChatStore from '@/stores/useChatStore';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';
import { getChatMessagesAfter } from '../api/chatApi';
import {
  DEFAULT_CHAT_MESSAGES_LIMIT,
  chatMessagesQueryKeys,
  getLatestCursorFromMessages,
} from './useChatMessages';

const MAX_RECONNECT_ATTEMPTS = 8;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 20000;

const isValidId = (value) => Number.isInteger(value) && value > 0;

const createClientMessageId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `tmp-${crypto.randomUUID()}`;
  }

  return `tmp-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const resolveWsUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
  const wsBase = baseUrl.replace(/^http/, 'ws');
  return `${wsBase.replace(/\/$/, '')}/ws/chat`;
};

const normalizeAuthor = (user) => {
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

const isFatalChatErrorCode = (code) => {
  if (typeof code !== 'string') {
    return false;
  }

  if (code.startsWith('AUTH_') || code.startsWith('SECURITY_') || code.startsWith('ADMIN_')) {
    return true;
  }

  return code === 'CHAT_NOT_FOUND';
};

const upsertMessageIntoList = (messages, incoming) => {
  if (!Array.isArray(messages)) {
    return [incoming];
  }

  const idx = messages.findIndex((m) => (
    (incoming.clientMessageId && m.clientMessageId === incoming.clientMessageId) ||
    (incoming.id && m.id === incoming.id)
  ));

  if (idx !== -1) {
    const updated = [...messages];
    // Об'єднуємо, щоб зберегти clientMessageId, якщо він був у існуючому записі, 
    // але сервер його не повернув (наприклад, при завантаженні історії)
    updated[idx] = { ...updated[idx], ...incoming, pending: false, status: 'sent' };
    return updated;
  }

  return [...messages, incoming];
};

export default function useChatConnection(chatId, options = {}) {
  const {
    enabled = true,
    limit = DEFAULT_CHAT_MESSAGES_LIMIT,
    lastKnownCursor = null,
  } = options;

  const queryClient = useQueryClient();
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const manualCloseRef = useRef(false);
  const fatalCloseRef = useRef(false);
  const lastFatalErrorRef = useRef(null);
  const lastCursorRef = useRef(null);
  const catchUpInProgressRef = useRef(false);
  const connectRef = useRef(null);

  const user = useAuthStore(selectUser);
  const {
    connectionState,
    setConnectionState,
    setReadonly,
    reset: resetChatStore,
  } = useChatStore();
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

  const mergeMessages = useCallback((messages, incomingMessages) => {
    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      return messages;
    }

    return incomingMessages.reduce(
      (acc, incoming) => upsertMessageIntoList(acc, incoming),
      messages || []
    );
  }, []);

  const catchUpMessages = useCallback(async (afterCursor) => {
    if (!afterCursor || catchUpInProgressRef.current) {
      return;
    }

    catchUpInProgressRef.current = true;

    try {
      const res = await getChatMessagesAfter(chatId, afterCursor, { limit });
      if (res?.success && Array.isArray(res.data?.messages)) {
        updateMessages((messages) => mergeMessages(messages, res.data.messages));
      }
    } catch (error) {
      console.warn('[Chat] Failed to catch up messages:', error);
    } finally {
      catchUpInProgressRef.current = false;
    }
  }, [chatId, limit, mergeMessages, updateMessages]);

  const handleChatJoined = useCallback((data) => {
    setReadonly(Boolean(data.readonly));
    setCapabilities(data.capabilities || null);
    setConnectionState('connected');
    reconnectAttemptsRef.current = 0;
    fatalCloseRef.current = false;
    lastFatalErrorRef.current = null;

    const localCursor = lastCursorRef.current;
    const snapshotCursor = data.snapshotCursor || null;
    if (localCursor && snapshotCursor && localCursor !== snapshotCursor) {
      catchUpMessages(localCursor);
    } else if (!localCursor && snapshotCursor) {
      lastCursorRef.current = snapshotCursor;
    }
  }, [catchUpMessages, setConnectionState, setReadonly]);

  const handleChatMessage = useCallback((data) => {
    if (!data.message) return;

    upsertMessage({
      ...data.message,
      ...(data.clientMessageId ? { clientMessageId: data.clientMessageId } : {}),
    });
  }, [upsertMessage]);

  const handleChatError = useCallback((data) => {
    if (data.clientMessageId) {
      markOptimisticFailed(data.clientMessageId);
    }

    if (!isFatalChatErrorCode(data.code)) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    fatalCloseRef.current = true;
    lastFatalErrorRef.current = data.message || 'Помилка доступу до чату';
    manualCloseRef.current = true;
    setConnectionState('error', lastFatalErrorRef.current);
    socketRef.current?.close();
  }, [markOptimisticFailed, setConnectionState]);

  const handleIncomingMessage = useCallback((event) => {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch (error) {
      console.error('[Chat] Failed to parse WS message:', error);
      return;
    }

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
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message = JSON.stringify({ type, ...payload });
    socketRef.current.send(message);
    return true;
  }, []);

  const sendMessage = useCallback((content) => {
    const trimmedContent = content?.trim();

    if (!trimmedContent) {
      return null;
    }

    if (connectionState !== 'connected') {
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
  }, [appendOptimisticMessage, chatId, connectionState, sendEvent]);

  const joinChat = useCallback(() => {
    if (!isValidId(chatId)) {
      return;
    }

    sendEvent('chat:join', {
      chatId,
      lastKnownCursor: lastCursorRef.current || lastKnownCursor || undefined,
    });
  }, [chatId, lastKnownCursor, sendEvent]);

  const leaveChat = useCallback(() => {
    if (!isValidId(chatId)) {
      return;
    }

    sendEvent('chat:leave', { chatId });
  }, [chatId, sendEvent]);

  const disconnect = useCallback(() => {
    manualCloseRef.current = true;
    leaveChat();

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    fatalCloseRef.current = false;
    lastFatalErrorRef.current = null;

    setConnectionState('disconnected');
  }, [leaveChat, setConnectionState]);

  const connect = useCallback((isReconnect = false) => {
    if (!enabled || socketRef.current || !isValidId(chatId)) {
      return;
    }

    manualCloseRef.current = false;
    fatalCloseRef.current = false;
    lastFatalErrorRef.current = null;
    if (isReconnect) {
      setConnectionState('reconnecting');
    } else {
      setConnectionState('connecting');
    }

    const ws = new WebSocket(resolveWsUrl());
    socketRef.current = ws;

    ws.onopen = () => {
      joinChat();
    };

    ws.onmessage = handleIncomingMessage;

    ws.onerror = (event) => {
      console.warn('[Chat] WS error event', event);
    };

    ws.onclose = () => {
      socketRef.current = null;

      if (fatalCloseRef.current) {
        setConnectionState('error', lastFatalErrorRef.current || 'Помилка доступу до чату');
        return;
      }

      if (manualCloseRef.current) {
        setConnectionState('disconnected');
        return;
      }

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, attempt - 1),
          MAX_RECONNECT_DELAY
        );

        setConnectionState('reconnecting');
        reconnectTimeoutRef.current = setTimeout(() => {
          connectRef.current?.(true);
        }, delay);
        return;
      }

      setConnectionState('error', 'Не вдалося перепідключитись');
    };
  }, [chatId, enabled, handleIncomingMessage, joinChat, setConnectionState]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (lastKnownCursor) {
      lastCursorRef.current = lastKnownCursor;
    }
  }, [lastKnownCursor]);

  // Reset store state when chatId changes or on unmount to prevent
  // stale readonly / connectionState from leaking into the next chat.
  useEffect(() => {
    return () => {
      resetChatStore();
    };
  }, [chatId, resetChatStore]);

  useEffect(() => {
    if (enabled && isValidId(chatId)) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [chatId, connect, disconnect, enabled]);

  return {
    connectionState,
    capabilities,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting' || connectionState === 'reconnecting',
    hasError: connectionState === 'error',
    sendMessage,
    connect,
    disconnect,
  };
}
