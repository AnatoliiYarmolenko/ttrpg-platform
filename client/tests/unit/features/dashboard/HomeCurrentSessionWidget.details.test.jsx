import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

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

describe('HomeCurrentSessionWidget details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders data state with badges and session details', async () => {
    const user = userEvent.setup();
    const activeStartAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockQueryState({
      data: {
        id: 123,
        title: 'Curse of Strahd #5',
        startAt: activeStartAt,
        status: 'ACTIVE',
        myRole: 'PLAYER',
        visibility: 'PRIVATE',
        system: 'D&D 5e',
        organizerName: 'Alex GM',
        confirmedGmName: 'Alex GM',
        description: 'Темна ніч у Баровії.',
        campaign: { id: 7, title: 'Barovia Nights', canOpenDirectly: true },
        maxPlayers: 6,
        currentPlayers: 4,
        participantsCount: 5,
      },
    });

    render(<MemoryRouter><HomeCurrentSessionWidget /></MemoryRouter>);

    expect(screen.getByText('Поточна сесія')).toBeInTheDocument();
    expect(screen.getByText('Curse of Strahd #5')).toBeInTheDocument();
    expect(screen.getByText('Сесія вже йде!')).toBeInTheDocument();
    expect(screen.queryByText('В процесі')).not.toBeInTheDocument();
    expect(screen.getByText('Гравець')).toBeInTheDocument();
    expect(screen.getByText('Система:').closest('div')).toHaveTextContent(/Система:\s*D&D 5e/);
    const campaignLink = screen.getByRole('link', { name: 'Barovia Nights' });
    expect(campaignLink).toHaveAttribute('href', '/campaign/7');
    expect(screen.getByText('4 / 6 гравців')).toBeInTheDocument();
    expect(screen.getByText('Доступність:').closest('div')).toHaveTextContent(/Доступність:\s*Звичайна/);
    expect(screen.getByText('Організатор:').closest('div')).toHaveTextContent(/Організатор:\s*Alex GM/);
    expect(screen.queryByText('GM: Alex GM')).not.toBeInTheDocument();
    expect(screen.getByText('Опис')).toBeInTheDocument();
    expect(screen.getByText('Темна ніч у Баровії.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Перейти до сесії' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/session/123');
  });

  it('renders campaign title as plain text on home widget when campaign cannot be opened directly', () => {
    mockQueryState({
      data: {
        id: 124,
        title: 'Guest Session',
        startAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: 'PLANNED',
        myRole: 'PLAYER',
        visibility: 'PUBLIC',
        campaign: { id: 8, title: 'Secret Archive', canOpenDirectly: false },
        currentPlayers: 2,
        participantsCount: 2,
      },
    });

    render(<MemoryRouter><HomeCurrentSessionWidget /></MemoryRouter>);

    expect(screen.getByText('Secret Archive')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Secret Archive' })).not.toBeInTheDocument();
  });

  it('does not use participantsCount as capacity fallback when maxPlayers is missing', () => {
    mockQueryState({
      data: {
        id: 777,
        title: 'One-shot Public',
        startAt: '2026-04-12T18:00:00.000Z',
        status: 'PLANNED',
        myRole: 'PLAYER',
        visibility: 'PUBLIC',
        campaign: null,
        description: 'One-shot для двох гравців',
        currentPlayers: 1,
        participantsCount: 2,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('1 гравців')).toBeInTheDocument();
    expect(screen.queryByText('1/2')).not.toBeInTheDocument();
  });
});
