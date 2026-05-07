import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { queryClient } from '@/lib/queryClient';

const notificationStoreMock = vi.hoisted(() => {
  const state = {
    connectionState: 'disconnected',
    connectionError: null,
    liveNotifications: [],
  };

  const api = {
    setConnectionState: (nextState, error = null) => {
      state.connectionState = nextState;
      state.connectionError = error;
    },
    addLiveNotification: (notification) => {
      state.liveNotifications = [notification, ...state.liveNotifications].slice(0, 50);
    },
    clearLiveNotifications: () => {
      state.liveNotifications = [];
    },
    reset: () => {
      state.connectionState = 'disconnected';
      state.connectionError = null;
      state.liveNotifications = [];
    },
    getState: () => ({ ...state, ...api }),
  };

  const store = (selector) => {
    const snapshot = api.getState();
    return typeof selector === 'function' ? selector(snapshot) : snapshot;
  };

  store.getState = api.getState;
  store.reset = api.reset;

  return { store, api };
});

vi.mock('@/stores/useNotificationStore', () => ({
  default: notificationStoreMock.store,
}));

const { default: useNotificationSSE } = await import('@/features/notifications/hooks/useNotificationSSE');

describe('useNotificationSSE', () => {
  const createdInstances = [];

  class TestEventSource {
    constructor(url, options) {
      this.url = url;
      this.withCredentials = options?.withCredentials;
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.closed = false;
      createdInstances.push(this);
    }

    close() {
      this.closed = true;
    }
  }

  beforeEach(() => {
    createdInstances.length = 0;
    notificationStoreMock.api.reset();
    vi.stubGlobal('EventSource', TestEventSource);
    vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    notificationStoreMock.api.reset();
  });

  it('stores live notifications and invalidates session-related caches for session events', async () => {
    renderHook(() => useNotificationSSE(true));

    await waitFor(() => {
      expect(createdInstances).toHaveLength(1);
    });
    expect(createdInstances[0].url).toBe('http://localhost:5000/api/notifications/stream');
    expect(createdInstances[0].withCredentials).toBe(true);

    const notification = {
      id: 101,
      title: 'Session confirmed',
      type: 'session_confirmed',
      metadata: { sessionId: 42 },
    };

    await act(async () => {
      createdInstances[0].onmessage?.({
        data: JSON.stringify({ type: 'notification', data: notification }),
      });
    });

    await waitFor(() => {
      expect(notificationStoreMock.api.getState().liveNotifications[0]).toMatchObject(notification);
    });

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['session-page', 42] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['session', 42] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['campaign-page'] });
  });

  it('reconnects after an error with backoff and closes the current connection', async () => {
    renderHook(() => useNotificationSSE(true));

    expect(createdInstances).toHaveLength(1);

    vi.useFakeTimers();

    await act(async () => {
      createdInstances[0].onerror?.(new Event('error'));
    });

    expect(createdInstances[0].closed).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(createdInstances).toHaveLength(2);
    expect(createdInstances[1].url).toBe('http://localhost:5000/api/notifications/stream');
  });
});