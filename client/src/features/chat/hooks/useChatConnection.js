import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useChatStore from '@/stores/useChatStore';
import useVttStore from '@/stores/useVttStore';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';
import useBattlefieldStore from '@/features/vtt/components/battlefield/useBattlefieldStore';
import { getChatMessagesAfter, getChatMessagesBefore } from '../api/chatApi';
import {
  DEFAULT_CHAT_MESSAGES_LIMIT,
  chatMessagesQueryKeys,
  getLatestCursorFromMessages,
  buildChatCursor,
} from './useChatMessages';
import api from '@/lib/axios';
import { resolveMediaUrl, resolveSceneUrls } from '@/lib/resolveMediaUrl';

const MAX_RECONNECT_ATTEMPTS = 8;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 20000;

const isValidId = (value) => Number.isInteger(value) && value > 0;

const createClientMessageId = () => {
  return `tmp-${crypto.randomUUID()}`;
};

const handleVttStateOrOpened = (data) => {
  if (data.sessionId != null) {
    useVttStore.getState().setVttOpen(data.sessionId, Boolean(data.isOpen));
  }
  if (data.type === 'vtt:state') {
    const resolvedData = {
      ...data,
      scenes: data.scenes ? resolveSceneUrls(structuredClone(data.scenes)) : data.scenes,
      backgroundUrl: data.backgroundUrl ? resolveMediaUrl(data.backgroundUrl) : data.backgroundUrl,
    };
    useBattlefieldStore.getState().setVttState(resolvedData);
    
    // Синхронізуємо історію кидків при повному завантаженні стану
    if (Array.isArray(data.diceLog)) {
      useVttStore.setState({ rollHistory: data.diceLog });
    }
  } else if (data.backgroundUrl) {
    useBattlefieldStore.getState().setBackgroundUrl(
      resolveMediaUrl(data.backgroundUrl) ?? data.backgroundUrl,
      data.mapWidth,
      data.mapHeight,
    );
  }
};

const handleVttMessage = (data) => {
  const type = data.type;

  if (type === 'vtt:scene:previewImage') {
    useBattlefieldStore.getState().previewSceneImage(data.sceneId, data.imageId, data.updates);
    return;
  }

  if (type === 'vtt:opened' || type === 'vtt:state') {
    handleVttStateOrOpened(data);
    return;
  }

  if (type === 'vtt:dice:result' && data.roll) {
    // Встановлюємо кубики для 3D анімації
    useVttStore.getState().setIncomingRoll(data.roll);
    
    // Результат в чат (addRollResult) тепер додається в DiceRoller3D.jsx після завершення анімації
    // Якщо ми не на сторінці VTT, то кубики можуть не показатися, тому додамо тайм-аут про всяк випадок
    setTimeout(() => {
      const state = useVttStore.getState();
      // Якщо результат ще не доданий (ідентифікатор), додамо його
      if (!state.rollHistory.some(r => r.id === data.roll.id)) {
        state.addRollResult(data.roll);
      }
    }, 6000); // Резервний таймер, якщо анімація не відпрацювала
    
    return;
  }

  if (type === 'vtt:token_drag' || type === 'vtt:token_drop') {
    if (data.tokenId != null && data.x != null && data.y != null) {
      useBattlefieldStore.getState().moveToken(data.tokenId, data.x, data.y);
    }
    return;
  }

  if (type === 'vtt:set_background' && data.backgroundUrl !== undefined) {
    useBattlefieldStore.getState().setBackgroundUrl(
      resolveMediaUrl(data.backgroundUrl) ?? data.backgroundUrl,
      data.mapWidth,
      data.mapHeight,
    );
  }
};

export const resolveWsUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const baseUrl = apiBaseUrl.replace(/\/api\/?$/, '');
  const wsBase = baseUrl.replace(/^http/, 'ws');
  return `${wsBase.replace(/\/$/, '')}/ws/chat`;
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
      queryClient.invalidateQueries({ queryKey });
      lastCursorRef.current = snapshotCursor;
    }
  }, [catchUpMessages, setConnectionState, setReadonly, queryClient, queryKey]);

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
    lastFatalErrorRef.current = data.message || 'Access denied to chat';
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
      return;
    }

    if (data.type?.startsWith('vtt:')) {
      handleVttMessage(data);
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
      lastKnownCursor: lastCursorRef.current || undefined,
    });
  }, [chatId, sendEvent]);

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
        setConnectionState('error', lastFatalErrorRef.current || 'Access denied to chat');
        return;
      }

      if (manualCloseRef.current) {
        setConnectionState('disconnected');
        return;
      }

      api.get('/profile/me').catch(() => {});
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

      setConnectionState('error', 'Failed to reconnect');
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
    if (!enabled || !isValidId(chatId)) return undefined;

    // Невелика затримка (0ms мікрозадача) захищає від React Strict Mode:
    // у dev-режимі React навмисно монтує двічі; без затримки cleanup першого
    // монтування закриває WS до того, як він встиг відкритися.
    const timerId = setTimeout(() => {
      connect();
    }, 0);

    return () => {
      clearTimeout(timerId);
      disconnect();
    };
  }, [chatId, connect, disconnect, enabled]);

  useEffect(() => {
    const onFocus = () => {
      const state = useChatStore.getState().connectionState;
      if ((state === 'error' || state === 'disconnected') && enabled && isValidId(chatId)) {
        connectRef.current?.(true);
      }
    };
    
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [chatId, enabled]);

  const sendVttOpen = useCallback(() => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:open', { chatId });
  }, [chatId, sendEvent]);

  const sendVttGetState = useCallback(() => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:getState', { chatId });
  }, [chatId, sendEvent]);

  const sendVttTokenDrag = useCallback((tokenId, x, y) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:token_drag', { chatId, tokenId, x, y });
  }, [chatId, sendEvent]);

  const sendVttTokenDrop = useCallback((tokenId, x, y) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:token_drop', { chatId, tokenId, x, y });
  }, [chatId, sendEvent]);

  const sendVttDiceRoll = useCallback((formula, name) => {
    if (!isValidId(chatId)) return false;
    const strength = useVttStore.getState().rollStrength || 1;
    return sendEvent('vtt:dice:roll', { chatId, formula, name, strength });
  }, [chatId, sendEvent]);

  const sendVttSetBackground = useCallback((backgroundUrl, mapWidth, mapHeight) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:set_background', { chatId, backgroundUrl, mapWidth, mapHeight });
  }, [chatId, sendEvent]);

  const sendVttSceneCreate = useCallback((data) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:create', { chatId, ...data });
  }, [chatId, sendEvent]);

  const sendVttSceneUpdate = useCallback((sceneId, updates) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:update', { chatId, sceneId, updates });
  }, [chatId, sendEvent]);

  const sendVttSceneDelete = useCallback((sceneId) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:delete', { chatId, sceneId });
  }, [chatId, sendEvent]);

  const sendVttSceneActivate = useCallback((sceneId) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:activate', { chatId, sceneId });
  }, [chatId, sendEvent]);

  const sendVttLayerCreate = useCallback((sceneId, name, layerType) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:layer:create', { chatId, sceneId, name, layerType });
  }, [chatId, sendEvent]);

  const sendVttLayerUpdate = useCallback((sceneId, layerId, updates) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:layer:update', { chatId, sceneId, layerId, updates });
  }, [chatId, sendEvent]);

  const sendVttLayerReorder = useCallback((sceneId, layerIds) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:layer:reorder', { chatId, sceneId, layerIds });
  }, [chatId, sendEvent]);

  const sendVttLayerDelete = useCallback((sceneId, layerId) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:layer:delete', { chatId, sceneId, layerId });
  }, [chatId, sendEvent]);

  const sendVttSceneAddImage = useCallback((sceneId, imageUrl, imageWidth, imageHeight) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:addImage', { chatId, sceneId, imageUrl, imageWidth, imageHeight });
  }, [chatId, sendEvent]);

  const sendVttSceneUpdateImage = useCallback((sceneId, imageId, updates) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:updateImage', { chatId, sceneId, imageId, updates });
  }, [chatId, sendEvent]);

  const sendVttScenePreviewImage = useCallback((sceneId, imageId, updates) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:previewImage', { chatId, sceneId, imageId, updates });
  }, [chatId, sendEvent]);

  const sendVttSceneRemoveImage = useCallback((sceneId, imageId) => {
    if (!isValidId(chatId)) return false;
    return sendEvent('vtt:scene:removeImage', { chatId, sceneId, imageId });
  }, [chatId, sendEvent]);

  return {
    connectionState,
    capabilities,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting' || connectionState === 'reconnecting',
    hasError: connectionState === 'error',
    sendMessage,
    loadOlderMessages,
    connect,
    disconnect,
    sendVttOpen,
    sendVttGetState,
    sendVttTokenDrag,
    sendVttTokenDrop,
    sendVttDiceRoll,
    sendVttSetBackground,
    sendVttSceneCreate,
    sendVttSceneUpdate,
    sendVttSceneDelete,
    sendVttSceneActivate,
    sendVttLayerCreate,
    sendVttLayerUpdate,
    sendVttLayerReorder,
    sendVttLayerDelete,
    sendVttSceneAddImage,
    sendVttSceneUpdateImage,
    sendVttScenePreviewImage,
    sendVttSceneRemoveImage,
  };
}
