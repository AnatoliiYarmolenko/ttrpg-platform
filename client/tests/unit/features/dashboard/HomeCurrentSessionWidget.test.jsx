import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VIEW_MODES } from '@/features/dashboard/constants';
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

describe('HomeCurrentSessionWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders loading state', () => {
    mockQueryState({ isLoading: true });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Завантаження...')).toBeInTheDocument();
  });

  it('renders error state and retries on button click', async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockQueryState({
      isError: true,
      error: new Error('Помилка мережі'),
      refetch,
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Не вдалося завантажити сесію')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Оновити' }));

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('renders strong empty state with search and calendar CTAs', async () => {
    const user = userEvent.setup();
    mockQueryState({ data: null });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Наступна сесія')).toBeInTheDocument();
    expect(screen.getByText('Тут поки пусто')).toBeInTheDocument();

    const searchButton = screen.getByRole('button', { name: 'Пошук сесій' });
    const chooseButton = screen.getByRole('button', { name: 'Відкрити календар' });

    const ctaContainer = searchButton.closest('div');
    expect(ctaContainer).toHaveClass('grid-cols-1');
    expect(ctaContainer).toHaveClass('sm:grid-cols-2');

    await user.click(searchButton);
    expect(mocks.setSearchParams).toHaveBeenCalledTimes(1);

    const [searchUpdater] = mocks.setSearchParams.mock.calls[0];
    const searchParamsAfterSearch = searchUpdater(new URLSearchParams());
    expect(searchParamsAfterSearch.get('tab')).toBe(VIEW_MODES.SEARCH);
    expect(searchParamsAfterSearch.get('section')).toBeNull();

    await user.click(chooseButton);
    expect(mocks.setSearchParams).toHaveBeenCalledTimes(2);

    const [calendarUpdater] = mocks.setSearchParams.mock.calls[1];
    const searchParamsAfterCalendar = calendarUpdater(new URLSearchParams());
    expect(searchParamsAfterCalendar.get('tab')).toBe(VIEW_MODES.CALENDAR);
    expect(searchParamsAfterCalendar.get('section')).toBeNull();
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
        campaign: { id: 7, title: 'Barovia Nights' },
        maxPlayers: 6,
        currentPlayers: 4,
        participantsCount: 5,
      },
    });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByText('Поточна сесія')).toBeInTheDocument();
    expect(screen.getByText('Curse of Strahd #5')).toBeInTheDocument();
    expect(screen.getByText('Сесія вже йде!')).toBeInTheDocument();
    expect(screen.queryByText('В процесі')).not.toBeInTheDocument();
    expect(screen.getByText('Гравець')).toBeInTheDocument();
    expect(screen.getByText('Система:').closest('div')).toHaveTextContent(/Система:\s*D&D 5e/);
    expect(screen.getByText(/Barovia Nights/)).toBeInTheDocument();
    expect(screen.getByText('4 / 6 гравців')).toBeInTheDocument();
    expect(screen.getByText('Доступність:').closest('div')).toHaveTextContent(/Доступність:\s*Звичайна сесія/);
    expect(screen.getByText('Організатор:').closest('div')).toHaveTextContent(/Організатор:\s*Alex GM/);
    expect(screen.queryByText('GM: Alex GM')).not.toBeInTheDocument();
    expect(screen.getByText('Опис')).toBeInTheDocument();
    expect(screen.getByText('Темна ніч у Баровії.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Перейти до сесії' }));
    expect(mocks.navigate).toHaveBeenCalledWith('/session/123');
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
