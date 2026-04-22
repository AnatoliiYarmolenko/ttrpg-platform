import React from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import useSessionPageController from '@/features/sessions/hooks/useSessionPageController';
import { SESSION_TABS, COMMUNICATION_MODES } from '@/features/sessions/constants/sessionTabs';

const mockUseSessionPageQuery = vi.fn();
const mockUseSessionMutations = vi.fn();
const mockUseSessionShareLinkQuery = vi.fn();
const mockUseAuthStore = vi.fn();

vi.mock('@/features/sessions/hooks/useSessionQueries', () => ({
  useSessionPageQuery: (...args) => mockUseSessionPageQuery(...args),
  useSessionMutations: (...args) => mockUseSessionMutations(...args),
  useSessionShareLinkQuery: (...args) => mockUseSessionShareLinkQuery(...args),
}));

vi.mock('@/stores/useAuthStore', () => ({
  default: (selector) => mockUseAuthStore(selector),
}));

function buildSessionPageData(overrides = {}) {
  return {
    entity: {
      id: 5,
      title: 'Session test',
      status: 'PLANNED',
      date: new Date(Date.now() + 3_600_000).toISOString(),
      visibility: 'PUBLIC',
      ownerId: 1,
      participants: [],
    },
    viewer: {
      role: null,
      isSessionOwner: false,
      isParticipant: false,
      isCampaignMember: false,
    },
    actions: {
      canStart: false,
      canFinish: false,
      canCancel: false,
      canDelete: false,
      canEditSettings: false,
      canManageParticipants: false,
      canManageGmRequests: false,
      canManageShareLink: false,
      canJoin: true,
      canApplyAsGm: false,
    },
    sections: {
      participants: {
        visible: true,
        items: [],
        count: 0,
        maxPlayers: 4,
      },
      campaign: {
        visible: false,
        linkable: false,
        data: null,
      },
    },
    ui: {
      previewMode: true,
      availableTabs: [SESSION_TABS.DETAILS, SESSION_TABS.COMMUNICATION],
    },
    ...overrides,
  };
}

function createWrapper(initialEntry) {
  return function Wrapper({ children }) {
    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/session/:id" element={children} />
        </Routes>
      </MemoryRouter>
    );
  };
}

describe('useSessionPageController tab state', () => {
  beforeEach(() => {
    mockUseAuthStore.mockImplementation((selector) => selector({ user: { id: 11 } }));
    mockUseSessionMutations.mockReturnValue({
      joinSession: vi.fn(),
      leaveSession: vi.fn(),
      updateStatus: vi.fn(),
      cancelSession: vi.fn(),
      updateSession: vi.fn(),
      finishSession: vi.fn(),
      deleteSession: vi.fn(),
      updateParticipantStatus: vi.fn(),
      regenerateShareLink: vi.fn(),
    });
    mockUseSessionShareLinkQuery.mockReturnValue({
      data: null,
      refetch: vi.fn(),
    });
  });

  it('reads communication deeplink params from URL', () => {
    mockUseSessionPageQuery.mockReturnValue({
      data: buildSessionPageData(),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useSessionPageController(), {
      wrapper: createWrapper('/session/5?tab=communication&comm=participants'),
    });

    expect(result.current.activeTab).toBe(SESSION_TABS.COMMUNICATION);
    expect(result.current.communicationPanelMode).toBe(COMMUNICATION_MODES.PARTICIPANTS);
  });

  it('falls back from manage tab when viewer has no manage permission', async () => {
    mockUseSessionPageQuery.mockReturnValue({
      data: buildSessionPageData(),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useSessionPageController(), {
      wrapper: createWrapper('/session/5?tab=manage'),
    });

    await waitFor(() => {
      expect(result.current.activeTab).toBe(SESSION_TABS.DETAILS);
    });
  });

  it('opens profile preview via viewingUserId url param', async () => {
    mockUseSessionPageQuery.mockReturnValue({
      data: buildSessionPageData(),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useSessionPageController(), {
      wrapper: createWrapper('/session/5'),
    });

    act(() => {
      result.current.handleViewProfile(42);
    });

    await waitFor(() => {
      expect(result.current.viewingUserId).toBe(42);
    });
  });

  it('toggles communication panel mode via setter', async () => {
    mockUseSessionPageQuery.mockReturnValue({
      data: buildSessionPageData(),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useSessionPageController(), {
      wrapper: createWrapper('/session/5?tab=communication'),
    });

    act(() => {
      result.current.setCommunicationPanelMode(COMMUNICATION_MODES.PARTICIPANTS);
    });

    await waitFor(() => {
      expect(result.current.communicationPanelMode).toBe(COMMUNICATION_MODES.PARTICIPANTS);
    });
  });

  it('maps participants summary and confirmed GM flag into currentSession', () => {
    mockUseSessionPageQuery.mockReturnValue({
      data: buildSessionPageData({
        sections: {
          participants: {
            visible: false,
            items: [],
            count: 3,
            hasConfirmedGm: true,
            maxPlayers: 4,
          },
          campaign: {
            visible: false,
            linkable: false,
            data: null,
          },
        },
      }),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useSessionPageController(), {
      wrapper: createWrapper('/session/5'),
    });

    expect(result.current.currentSession.participantsSummaryCount).toBe(3);
    expect(result.current.currentSession.hasConfirmedGm).toBe(true);
    expect(result.current.currentSession.participants).toEqual([]);
  });

  it('falls back to entity campaign for visibility and link when sections.campaign flags are absent', () => {
    mockUseSessionPageQuery.mockReturnValue({
      data: buildSessionPageData({
        entity: {
          id: 5,
          title: 'Session test',
          status: 'PLANNED',
          date: new Date(Date.now() + 3_600_000).toISOString(),
          visibility: 'PUBLIC',
          ownerId: 1,
          campaign: {
            id: 77,
            title: 'Fallback Campaign',
          },
        },
        actions: {
          canOpenCampaign: true,
        },
        sections: {
          participants: {
            visible: false,
            items: [],
            count: 0,
            hasConfirmedGm: false,
            maxPlayers: 4,
          },
          campaign: {
            data: null,
          },
        },
      }),
      isLoading: false,
      error: null,
    });

    const { result } = renderHook(() => useSessionPageController(), {
      wrapper: createWrapper('/session/5'),
    });

    expect(result.current.showCampaignInfo).toBe(true);
    expect(result.current.canNavigateToCampaignDirectly).toBe(true);
    expect(result.current.campaignNavigationTarget).toBe('/campaign/77?tab=details');
  });
});

