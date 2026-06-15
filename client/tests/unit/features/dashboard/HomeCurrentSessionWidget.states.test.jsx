import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('HomeCurrentSessionWidget states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('renders loading state', () => {
    mockQueryState({ isLoading: true });

    render(<HomeCurrentSessionWidget />);

    expect(screen.getByTestId('skeleton-session-detail')).toBeInTheDocument();
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
});
