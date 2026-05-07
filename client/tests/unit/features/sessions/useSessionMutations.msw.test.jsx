import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useCampaignPageQuery } from '@/features/campaigns/hooks/useCampaignQueries';
import { useSessionMutations } from '@/features/sessions/hooks/useSessionQueries';

const API_BASE = 'http://localhost:5000/api';

let campaignPageCalls = 0;

const server = setupServer(
  http.get(`${API_BASE}/campaigns/:campaignId/page`, ({ params }) => {
    campaignPageCalls += 1;

    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.campaignId),
        title: 'Test Campaign',
      },
    });
  }),
  http.patch(`${API_BASE}/sessions/:sessionId`, async ({ request, params }) => {
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      data: {
        id: Number(params.sessionId),
        campaignId: 12,
        ...body,
      },
    });
  })
);

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

describe('useSessionMutations with MSW', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    campaignPageCalls = 0;
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('invalidates campaign-page after updateSession', async () => {
    const campaignId = 12;
    const sessionId = 99;
    const wrapper = createWrapper();

    const { result } = renderHook(
      () => {
        const campaignQuery = useCampaignPageQuery({ campaignId });
        const { updateSession } = useSessionMutations(sessionId);
        return { campaignQuery, updateSession };
      },
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.campaignQuery.isSuccess).toBe(true);
    });

    expect(campaignPageCalls).toBe(1);

    await act(async () => {
      await result.current.updateSession({ title: 'Updated title' });
    });

    await waitFor(() => {
      expect(campaignPageCalls).toBe(2);
    });
  });
});
