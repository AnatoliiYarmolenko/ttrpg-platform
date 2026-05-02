import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNextRelevantSessionQuery } from '@/features/dashboard/hooks/useDashboardQueries';
import HomeCurrentSessionWidget from '@/features/dashboard/components/widgets/HomeCurrentSessionWidget';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
}));

vi.mock('@/features/dashboard/hooks/useDashboardQueries', () => ({
  useNextRelevantSessionQuery: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [new URLSearchParams(), mocks.setSearchParams],
  };
});

function mockQueryState(state = {}) {
  vi.mocked(useNextRelevantSessionQuery).mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...state,
  });
}

describe('HomeCurrentSessionWidget time behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('updates relative time for PLANNED session and switches to delayed message after start time', () => {
    vi.useFakeTimers();
    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:00:00.000Z'));
    });

    mockQueryState({
      data: {
        id: 321,
        title: 'Future Session',
        startAt: '2026-04-12T10:00:40.000Z',
        status: 'PLANNED',
        myRole: 'PLAYER',
        visibility: 'PRIVATE',
        campaign: null,
        currentPlayers: 2,
        participantsCount: 4,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText(/Почнеться/)).toBeInTheDocument();
    expect(screen.queryByText('Почнеться зовсім скоро')).not.toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:00:05.000Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('Почнеться зовсім скоро')).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:01:00.000Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('Сесія запізнюється на: 1 хв')).toBeInTheDocument();
  });

  it('shows fixed active timer message for ACTIVE session', () => {
    vi.useFakeTimers();
    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:00:00.000Z'));
    });

    mockQueryState({
      data: {
        id: 654,
        title: 'Active Session',
        startAt: '2026-04-12T09:59:30.000Z',
        status: 'ACTIVE',
        myRole: 'GM',
        visibility: 'PUBLIC',
        campaign: null,
        currentPlayers: 3,
        participantsCount: 3,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Сесія вже йде!')).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:02:30.000Z'));
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('Сесія вже йде!')).toBeInTheDocument();
  });

  it('shows delayed message for near-past PLANNED session within grace window', () => {
    vi.useFakeTimers();
    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:00:15.000Z'));
    });

    mockQueryState({
      data: {
        id: 655,
        title: 'Planned But Just Started',
        startAt: '2026-04-12T10:00:00.000Z',
        status: 'PLANNED',
        myRole: 'PLAYER',
        visibility: 'PUBLIC',
        campaign: null,
        currentPlayers: 1,
        participantsCount: 1,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Сесія запізнюється на: 1 хв')).toBeInTheDocument();
    expect(screen.queryByText('Почнеться зовсім скоро')).not.toBeInTheDocument();
  });

  it('shows neutral updating message when PLANNED session is beyond grace window', () => {
    vi.useFakeTimers();
    act(() => {
      vi.setSystemTime(new Date('2026-04-12T10:03:10.000Z'));
    });

    mockQueryState({
      data: {
        id: 656,
        title: 'Planned Too Late',
        startAt: '2026-04-12T10:00:00.000Z',
        status: 'PLANNED',
        plannedToleranceMinutes: 2,
        duration: 1,
        myRole: 'PLAYER',
        visibility: 'PUBLIC',
        campaign: null,
        currentPlayers: 1,
        participantsCount: 1,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Забута сесія')).toBeInTheDocument();
  });

  it('formats delayed message with hours and minutes after 60 minutes', () => {
    vi.useFakeTimers();
    act(() => {
      vi.setSystemTime(new Date('2026-04-12T11:05:00.000Z'));
    });

    mockQueryState({
      data: {
        id: 657,
        title: 'Planned Delayed Long',
        startAt: '2026-04-12T10:00:00.000Z',
        status: 'PLANNED',
        plannedToleranceMinutes: 120,
        myRole: 'PLAYER',
        visibility: 'PUBLIC',
        campaign: null,
        currentPlayers: 1,
        participantsCount: 1,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Сесія запізнюється на: 1 год 5 хв')).toBeInTheDocument();
  });
});
