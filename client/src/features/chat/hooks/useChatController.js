import { useMemo } from 'react';
import useChatMeta from './useChatMeta';
import useChatMessages from './useChatMessages';
import useChatConnection from './useChatConnection';
import useChatStore from '@/stores/useChatStore';

/**
 * useChatController — композиційний фасад для Chat UI.
 *
 * Комбінує:
 * - useChatMeta для отримання descriptor (capabilities, readonly)
 * - useChatMessages для initial load
 * - useChatConnection для WS lifecycle + optimistic send
 * - useChatStore для стану
 *
 * Повертає готові props для ChatPanel та xk методи send.
 *
 * @param {string} entityType - 'campaign' | 'session'
 * @param {number} entityId - ID кампанії/сесії
 * @param {Object} options - додаткові опції
 * @returns {Object} - готові props для ChatPanel + utility методи
 */
export default function useChatController(entityType, entityId, options = {}) {
  const { enabled = true } = options;

  const metaQuery = useChatMeta(entityType, entityId, { enabled });
  const chatId = metaQuery.data?.chat?.id || null;

  const messagesQuery = useChatMessages(chatId, {
    limit: 50,
    enabled: enabled && !!chatId,
  });

  const connectionHook = useChatConnection(chatId, {
    enabled: enabled && !!chatId,
    limit: 50,
    lastKnownCursor: messagesQuery.data?.latestCursor || null,
  });

  const { readonly: storeReadonly } = useChatStore();

  const isLoading = metaQuery.isLoading || messagesQuery.isLoading;
  const hasError = metaQuery.isError || messagesQuery.isError || connectionHook.hasError;
  const errorMessage = metaQuery.error?.message
    || messagesQuery.error?.message
    || 'Помилка завантаження чату';

  const readonly = storeReadonly || metaQuery.data?.chat?.readonly || false;

  const chatPanelProps = useMemo(
    () => ({
      title: metaQuery.data?.chat?.title || 'Чат',
      messages: messagesQuery.data?.messages || [],
      isLoadingMessages: messagesQuery.isLoading,
      isLoadingConnection: connectionHook.isConnecting,
      hasError,
      errorMessage,
      connectionState: connectionHook.connectionState,
      readonly,
      onSend: connectionHook.sendMessage,
    }),
    [
      metaQuery.data?.chat?.title,
      messagesQuery.data?.messages,
      messagesQuery.isLoading,
      connectionHook.isConnecting,
      connectionHook.connectionState,
      connectionHook.sendMessage,
      hasError,
      errorMessage,
      readonly,
    ]
  );

  return {
    // Props для ChatPanel
    chatPanelProps,

    // Loading/error states
    isLoading,
    hasError,
    errorMessage,

    // Chat metadata
    chatId,
    descriptor: metaQuery.data?.chat || null,
    capabilities: metaQuery.data?.capabilities || null,
    readonly,

    // Connection utilities
    connect: connectionHook.connect,
    disconnect: connectionHook.disconnect,
    sendMessage: connectionHook.sendMessage,
    connectionState: connectionHook.connectionState,
    isConnected: connectionHook.isConnected,

    // Query/mutation states
    metaQuery,
    messagesQuery,
  };
}
