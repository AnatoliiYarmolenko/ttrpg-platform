import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import useCampaignPageController from '@/features/campaigns/hooks/useCampaignPageController';
import { CAMPAIGN_TABS as TABS } from '@/features/campaigns/constants/campaignTabs';

const mockUseCampaignPageQuery = vi.fn();
const mockUseCampaignMutations = vi.fn();
const mockUseCampaignShareLinkQuery = vi.fn();
const mockUseAuthStore = vi.fn();

vi.mock('@/features/campaigns/hooks/useCampaignQueries', () => ({
  useCampaignPageQuery: (...args) => mockUseCampaignPageQuery(...args),
  useCampaignMutations: (...args) => mockUseCampaignMutations(...args),
  useCampaignShareLinkQuery: (...args) => mockUseCampaignShareLinkQuery(...args),
}));

vi.mock('@/stores/useAuthStore', () => ({
  default: (selector) => mockUseAuthStore(selector),
}));

function buildCampaignPageData(overrides = {}) {
  return {
    entity: {
      id: 12,
      title: 'Campaign test',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      ownerId: 1,
      createdAt: new Date().toISOString(),
    },
    viewer: {
      role: null,
      isOwner: false,
      isMember: false,
      pendingJoinRequestStatus: null,
    },
    actions: {
      canSubmitJoinRequest: true,
      canLeave: false,
      canEditSettings: false,
      canTransferOwnership: false,
      canManageShareLink: false,
      canCreateSessions: false,
    },
    sections: {
      members: {
        visible: false,
        count: 0,
        items: [],
      },
      joinRequests: {
        visible: false,
        count: 0,
        items: [],
      },
      sessions: {
        visible: true,
        count: 0,
        items: [],
      },
    },
    ui: {
      previewMode: true,
      availableTabs: [TABS.SESSIONS, TABS.DETAILS],
    },
    ...overrides,
  };
}

function createWrapper(initialEntry) {
  return function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/campaign/:id" element={children} />
        </Routes>
      </MemoryRouter>
    );
  };
}

describe('useCampaignPageController tab state', () => {
  beforeEach(() => {
    mockUseAuthStore.mockImplementation((selector) => selector({ user: { id: 11 } }));
    mockUseCampaignMutations.mockReturnValue({
      updateCampaign: vi.fn(),
      transferOwnership: vi.fn(),
      regenerateShareLink: vi.fn(),
      submitJoinRequest: vi.fn(),
      approveRequest: vi.fn(),
      rejectRequest: vi.fn(),
      removeMember: vi.fn(),
      changeMemberRole: vi.fn(),
      cancelSession: vi.fn(),
      deleteSession: vi.fn(),
    });
    mockUseCampaignShareLinkQuery.mockReturnValue({ data: null });
  });

  it('reads tab deeplink params from URL', () => {
    mockUseCampaignPageQuery.mockReturnValue({
      data: buildCampaignPageData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignPageController(), {
      wrapper: createWrapper('/campaign/12?tab=details'),
    });

    expect(result.current.activeTab).toBe(TABS.DETAILS);
  });

  it('falls back from settings tab when unavailable for viewer', async () => {
    mockUseCampaignPageQuery.mockReturnValue({
      data: buildCampaignPageData({
        ui: { previewMode: true, availableTabs: [TABS.SESSIONS, TABS.DETAILS] },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignPageController(), {
      wrapper: createWrapper('/campaign/12?tab=settings'),
    });

    await waitFor(() => {
      expect(result.current.activeTab).toBe(TABS.SESSIONS);
    });
  });

  it('opens profile preview via url state', async () => {
    mockUseCampaignPageQuery.mockReturnValue({
      data: buildCampaignPageData(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignPageController(), {
      wrapper: createWrapper('/campaign/12'),
    });

    act(() => {
      result.current.handleViewProfile(42);
    });

    await waitFor(() => {
      expect(result.current.viewingUserId).toBe(42);
    });
  });

  it('reads preview and join action only from server dto', () => {
    mockUseCampaignPageQuery.mockReturnValue({
      data: buildCampaignPageData({
        actions: {
          canSubmitJoinRequest: false,
          canLeave: false,
          canEditSettings: false,
          canTransferOwnership: false,
          canManageShareLink: false,
          canCreateSessions: false,
        },
        ui: {
          previewMode: false,
          availableTabs: [TABS.SESSIONS, TABS.DETAILS],
        },
      }),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignPageController(), {
      wrapper: createWrapper('/campaign/12'),
    });

    expect(result.current.isPreviewMode).toBe(false);
    expect(result.current.canJoin).toBe(false);
  });
});
