import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useNotificationMutations,
} from '@/features/notifications/hooks/useNotificationQueries';

const API_BASE = 'http://localhost:5000/api';

let notificationsCalls = 0;
let unreadCountCalls = 0;

const server = setupServer(
  http.get(`${API_BASE}/notifications`, () => {
    notificationsCalls += 1;

    return HttpResponse.json({
      success: true,
      data: {
        notifications: [
          { id: 1, title: 'Campaign approved', read: false },
        ],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      },
    });
  }),
  http.get(`${API_BASE}/notifications/unread-count`, () => {
    unreadCountCalls += 1;

    return HttpResponse.json({
      success: true,
      data: { count: 7 },
    });
  }),
  http.post(`${API_BASE}/notifications/:notificationId/read`, () => HttpResponse.json({ success: true }))
);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
};

describe('notification mutations with MSW', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    notificationsCalls = 0;
    unreadCountCalls = 0;
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('refetches notifications and unread count after markAsRead', async () => {
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => ({
        notificationsQuery: useNotificationsQuery(),
        unreadCountQuery: useUnreadCountQuery(),
        mutations: useNotificationMutations(),
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.notificationsQuery.isSuccess).toBe(true);
      expect(result.current.unreadCountQuery.isSuccess).toBe(true);
    });

    expect(notificationsCalls).toBe(1);
    expect(unreadCountCalls).toBe(1);

    await act(async () => {
      await result.current.mutations.markAsReadMutation.mutateAsync(1);
    });

    await waitFor(() => {
      expect(notificationsCalls).toBe(2);
      expect(unreadCountCalls).toBe(3);
    });
  });
});