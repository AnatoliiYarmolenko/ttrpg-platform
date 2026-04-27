import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AdminPage from '@/features/admin/pages/AdminPage';
import { logoutUser } from '@/features/auth/api/authApi';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  clearUser: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [new URLSearchParams(''), mocks.setSearchParams],
  };
});

vi.mock('@/stores/useAuthStore', () => ({
  __esModule: true,
  default: (selector) => {
    const state = {
      user: { id: 1, username: 'admin-user', role: 'ADMIN' },
      clearUser: mocks.clearUser,
    };
    return typeof selector === 'function' ? selector(state) : state;
  },
}));

vi.mock('@/features/auth/api/authApi', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 1, username: 'admin-user', role: 'ADMIN' })),
  logoutUser: vi.fn(),
}));

vi.mock('@/features/admin/hooks/useAdminQueries', () => ({
  useAdminStatsQuery: () => ({
    data: { users: 0, campaigns: 0, sessions: 0, activeSessions: 0 },
    isLoading: false,
  }),
  useAdminUsersQuery: () => ({ data: { users: [], pagination: null }, isLoading: false }),
  useAdminCampaignsQuery: () => ({ data: { campaigns: [], pagination: null }, isLoading: false }),
  useAdminSessionsQuery: () => ({ data: { sessions: [], pagination: null }, isLoading: false }),
  useAdminMutations: () => ({
    deleteCampaign: vi.fn(),
    deleteSession: vi.fn(),
  }),
}));

vi.mock('@/features/admin/components/StatsCards', () => ({
  default: () => <div>Stats</div>,
}));

vi.mock('@/features/admin/components/AdminSearchBar', () => ({
  default: () => <div>SearchBar</div>,
}));

vi.mock('@/features/admin/components/AdminPagination', () => ({
  default: () => <div>Pagination</div>,
}));

vi.mock('@/features/admin/components/ConfirmDeleteModal', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/NavButton', () => ({
  default: ({ label, onClick }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

describe('AdminPage logout modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logoutUser).mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens confirm modal and logs out only after confirm', async () => {
    const user = userEvent.setup();

    render(<AdminPage />);

    await user.click(screen.getAllByRole('button', { name: 'Вийти' })[0]);

    expect(logoutUser).not.toHaveBeenCalled();
    expect(screen.getByText('Вийти з акаунту?')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Вийти' }));

    await waitFor(() => {
      expect(logoutUser).toHaveBeenCalledTimes(1);
      expect(mocks.clearUser).toHaveBeenCalledTimes(1);
      expect(mocks.navigate).toHaveBeenCalledWith('/login');
    });
  });

  it('does not logout on cancel', async () => {
    const user = userEvent.setup();

    render(<AdminPage />);

    await user.click(screen.getAllByRole('button', { name: 'Вийти' })[0]);

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }));

    expect(logoutUser).not.toHaveBeenCalled();
    expect(mocks.clearUser).not.toHaveBeenCalled();
    expect(screen.queryByText('Вийти з акаунту?')).not.toBeInTheDocument();
  });
});
