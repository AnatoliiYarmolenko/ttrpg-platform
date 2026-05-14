import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useChatStore from '@/stores/useChatStore';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';
import {
  DEFAULT_CHAT_MESSAGES_LIMIT,
  chatMessagesQueryKeys,
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

const mergeMessageList = (messages, incoming) => {
  if (!Array.isArray(messages)) {
    return [incoming];
  }

  if (messages.some((message) => message.id === incoming.id)) {
    return messages;
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
  const connectRef = useRef(null);

  const user = useAuthStore(selectUser);
  const {
    connectionState,
    setConnectionState,
    setReadonly,
  } = useChatStore();
  const [capabilities, setCapabilities] = useState(null);

  const queryKey = useMemo(() => chatMessagesQueryKeys.byChat(chatId, limit), [chatId, limit]);

  const updateMessages = useCallback((updater) => {
    queryClient.setQueryData(queryKey, (old) => {
      const base = old || { messages: [], limit, total: 0 };
      const messages = updater(base.messages || []);
      return {
        ...base,
        messages,
        total: Number.isInteger(base.total) ? Math.max(base.total, messages.length) : messages.length,
      };
    });
  }, [queryClient, queryKey, limit]);

  const replaceOptimisticMessage = useCallback((clientMessageId, message) => {
    updateMessages((messages) => messages.map((item) => (
      item.clientMessageId === clientMessageId
        ? { ...message, clientMessageId }
        : item
    )));
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

    updateMessages((messages) => mergeMessageList(messages, optimisticMessage));
  }, [chatId, user, updateMessages]);

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
      setReadonly(Boolean(data.readonly));
      setCapabilities(data.capabilities || null);
      setConnectionState('connected');
      reconnectAttemptsRef.current = 0;
      return;
    }

    if (data.type === 'chat:message:new' && data.message) {
      if (data.clientMessageId) {
        replaceOptimisticMessage(data.clientMessageId, data.message);
      } else {
        updateMessages((messages) => mergeMessageList(messages, data.message));
      }
      return;
    }

    if (data.type === 'chat:error') {
      if (data.clientMessageId) {
        markOptimisticFailed(data.clientMessageId);
      }
    }
  }, [markOptimisticFailed, replaceOptimisticMessage, setConnectionState, setReadonly, updateMessages]);

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
      lastKnownCursor: lastKnownCursor || undefined,
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

    setConnectionState('disconnected');
  }, [leaveChat, setConnectionState]);

  const connect = useCallback(() => {
    if (!enabled || socketRef.current || !isValidId(chatId)) {
      return;
    }

    manualCloseRef.current = false;
    setConnectionState('connecting');

    const ws = new WebSocket(resolveWsUrl());
    socketRef.current = ws;

    ws.onopen = () => {
      joinChat();
    };

    ws.onmessage = handleIncomingMessage;

    ws.onerror = () => {
      setConnectionState('error', 'Connection error');
    };

    ws.onclose = () => {
      socketRef.current = null;

      if (manualCloseRef.current) {
        setConnectionState('disconnected');
      } else {
        setConnectionState('error', 'Connection closed');

        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const attempt = reconnectAttemptsRef.current + 1;
          reconnectAttemptsRef.current = attempt;
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, attempt - 1),
            MAX_RECONNECT_DELAY
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, delay);
        }
      }
    };
  }, [chatId, enabled, handleIncomingMessage, joinChat, setConnectionState]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

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
    isConnecting: connectionState === 'connecting',
    hasError: connectionState === 'error',
    sendMessage,
    connect,
    disconnect,
  };
}
