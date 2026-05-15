import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import useChatConnection from '@/features/chat/hooks/useChatConnection';
import * as chatApi from '@/features/chat/api/chatApi';
import { chatMessagesQueryKeys } from '@/features/chat/hooks/useChatMessages';

// Mock stores
const chatStoreMock = vi.hoisted(() => ({
  connectionState: 'disconnected',
  readonly: false,
  setConnectionState: vi.fn((s) => { chatStoreMock.connectionState = s; }),
  setReadonly: vi.fn((r) => { chatStoreMock.readonly = r; }),
  reset: vi.fn(),
}));

vi.mock('@/stores/useChatStore', () => ({
  default: (selector) => (typeof selector === 'function' ? selector(chatStoreMock) : chatStoreMock),
}));

vi.mock('@/stores/useAuthStore', () => {
  const authState = { user: { id: 7, username: 'test' } };
  return {
    default: (selector) => (typeof selector === 'function' ? selector(authState) : authState),
    selectUser: (s) => s.user,
  };
});

vi.mock('@/features/chat/api/chatApi', () => ({
  getChatMessagesAfter: vi.fn(),
}));

// WebSocket Mock
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.send = vi.fn();
    this.close = vi.fn();
    MockWebSocket.instances.push(this);
  }
  
  static instances = [];
  
  triggerOpen() {
    this.readyState = 1; // OPEN
    this.onopen?.();
  }

  simulateMessage(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateClose() {
    this.readyState = 3; // CLOSED
    this.onclose?.();
  }
}

describe('useChatConnection Integration', () => {
  let queryClient;
  let wrapper;

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    chatStoreMock.setConnectionState.mockClear();
  });

  describe('Catch-up logic', () => {
    it('automatically calls getChatMessagesAfter if snapshotCursor is newer', async () => {
      const chatId = 123;
      const lastKnownCursor = 'old-cursor';
      
      chatApi.getChatMessagesAfter.mockResolvedValue({
        success: true,
        data: { messages: [] }
      });

      renderHook(() => useChatConnection(chatId, { lastKnownCursor }), { wrapper });

      await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
      const ws = MockWebSocket.instances[0];

      await act(async () => {
        ws.triggerOpen();
      });

      await act(async () => {
        ws.simulateMessage({
          type: 'chat:joined',
          snapshotCursor: 'new-cursor',
          readonly: false
        });
      });

      expect(chatApi.getChatMessagesAfter).toHaveBeenCalledWith(chatId, 'old-cursor', expect.any(Object));
    });
  });

  describe('Error and status handling', () => {
    it('changes message status to failed upon receiving chat:error', async () => {
      const chatId = 123;
      const clientMessageId = 'tmp-456';
      
      const queryKey = chatMessagesQueryKeys.byChat(chatId, 50);
      queryClient.setQueryData(queryKey, {
        messages: [{
          clientMessageId,
          content: 'Hello',
          pending: true,
          status: 'pending'
        }]
      });

      renderHook(() => useChatConnection(chatId), { wrapper });

      await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
      const ws = MockWebSocket.instances[0];

      await act(async () => {
        ws.triggerOpen();
      });

      await act(async () => {
        ws.simulateMessage({
          type: 'chat:error',
          clientMessageId,
          code: 'MESSAGE_REJECTED',
          message: 'Bad words'
        });
      });

      const updatedData = queryClient.getQueryData(queryKey);
      expect(updatedData.messages[0].status).toBe('failed');
      expect(updatedData.messages[0].pending).toBe(false);
    });
  });

  describe('Automatic Reconnection (Exponential Backoff)', () => {
    it('attempts to reconnect after connection loss', async () => {
      const chatId = 123;
      renderHook(() => useChatConnection(chatId), { wrapper });

      await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
      const firstWs = MockWebSocket.instances[0];

      await act(async () => {
        firstWs.triggerOpen();
      });

      vi.useFakeTimers();

      await act(async () => {
        firstWs.simulateClose();
      });

      expect(chatStoreMock.setConnectionState).toHaveBeenCalledWith('reconnecting');

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(MockWebSocket.instances).toHaveLength(2);
      expect(MockWebSocket.instances[1].url).toContain('/ws/chat');
    });

    it('stops attempts after MAX_RECONNECT_ATTEMPTS', async () => {
      const chatId = 123;
      renderHook(() => useChatConnection(chatId), { wrapper });

      await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
      await act(async () => {
        MockWebSocket.instances[0].triggerOpen();
      });

      vi.useFakeTimers();

      for (let i = 0; i < 8; i++) {
        await act(async () => {
          MockWebSocket.instances[i].simulateClose();
        });
        
        const delay = 1000 * Math.pow(2, i);
        await act(async () => {
          vi.advanceTimersByTime(delay);
        });
      }

      expect(MockWebSocket.instances).toHaveLength(9);
      expect(chatStoreMock.setConnectionState).toHaveBeenCalledWith('error', 'Failed to reconnect');
    });
  });
});
