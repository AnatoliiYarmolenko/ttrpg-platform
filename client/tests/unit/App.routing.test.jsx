import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PropTypes from 'prop-types';

import App from '@/App';
import useAuthStore from '@/stores/useAuthStore';
import useDashboardStore from '@/stores/useDashboardStore';

vi.mock('@/hooks/useCsrfInit', () => ({
  useCsrfInit: () => ({ isInitialized: true, error: null }),
}));

vi.mock('@/features/auth/api/authApi', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 101, username: 'admin-user', email: 'admin@example.com', role: 'ADMIN' })),
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

vi.mock('@/features/admin/components/AdminSearchBar', () => ({
  default: ({ placeholder }) => (
    <div data-testid="admin-search-placeholder">{placeholder}</div>
  ),
}));

vi.mock('@/features/dashboard/components/layout/DashboardLayout', () => ({
  default: ({ topBar, leftPanel, rightPanel }) => (
    <div>
      <header>{topBar}</header>
      <main>
        <section>{leftPanel}</section>
        <aside>{rightPanel}</aside>
      </main>
    </div>
  ),
}));

vi.mock('@/features/dashboard/components/widgets/HomeCurrentSessionWidget', () => ({
  default: () => <div>Dashboard Home Left</div>,
}));

vi.mock('@/features/dashboard/components/widgets/HomeNotificationsWidget', () => ({
  default: () => <div>Dashboard Home Right</div>,
}));

vi.mock('@/features/dashboard/components/widgets/CalendarWidget', () => ({
  default: () => <div>Calendar Widget</div>,
}));

vi.mock('@/features/dashboard/components/widgets/HomeRightWidget', () => ({
  default: () => <div>Home Right Widget</div>,
}));

vi.mock('@/features/dashboard/components/widgets/MyGamesListWidget', () => ({
  default: () => <div>My Games List</div>,
}));

vi.mock('@/features/dashboard/components/widgets/MyCampaignsWidget', () => ({
  default: () => <div>My Campaigns</div>,
}));

vi.mock('@/features/campaigns/components/widgets/CreateCampaignWidget', () => ({
  default: () => <div>Create Campaign</div>,
}));

vi.mock('@/features/dashboard/components/widgets/SearchWidgets', () => ({
  SearchFiltersWidget: () => <div>Search Filters</div>,
  SearchResultsWidget: () => <div>Search Results</div>,
}));

vi.mock('@/features/dashboard/components/widgets/ProfilePageWidget', () => {
  const ProfileMenuWidgetMock = ({ currentSection, onSelectSection }) => (
    <div>
      <div data-testid="profile-menu">menu:{currentSection}</div>
      <button type="button" onClick={() => onSelectSection('info')}>
        set-info
      </button>
    </div>
  );

  ProfileMenuWidgetMock.propTypes = {
    currentSection: PropTypes.string,
    onSelectSection: PropTypes.func.isRequired,
  };

  const ProfileContentWidgetMock = ({ currentSection }) => (
    <div data-testid="profile-content">profile:{currentSection}</div>
  );

  ProfileContentWidgetMock.propTypes = {
    currentSection: PropTypes.string,
  };

  return {
    ProfileMenuWidget: ProfileMenuWidgetMock,
    ProfileContentWidget: ProfileContentWidgetMock,
  };
});

vi.mock('@/routes/ProtectedRoute', () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock('@/features/dashboard/components/DashboardNavigation', () => {
  const { useNavigate } = require('react-router-dom');
  const DashboardNavigationMock = ({ onLogout }) => {
    const navigate = useNavigate();

    return (
      <div>
        <button type="button" onClick={() => navigate('/admin')}>
          Адмін
        </button>
        <button type="button" onClick={onLogout}>
          Вийти
        </button>
      </div>
    );
  };

  DashboardNavigationMock.propTypes = {
    onLogout: PropTypes.func.isRequired,
  };

  return {
    default: DashboardNavigationMock,
  };
});

const ADMIN_USER = {
  id: 101,
  username: 'admin-user',
  email: 'admin@example.com',
  role: 'ADMIN',
};

const BASE_AUTH_STATE = {
  user: ADMIN_USER,
  isAuthenticated: true,
  isLoading: false,
  isHydrated: true,
  isSessionValidated: true,
};

function renderAppAt(pathname) {
  globalThis.history.pushState({}, '', pathname);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe('App routing', () => {
  beforeEach(() => {
    vi.useRealTimers();
    localStorage.clear();

    useAuthStore.setState(BASE_AUTH_STATE);
    useDashboardStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: true,
      isSessionValidated: true,
    });
    useDashboardStore.getState().reset();
  });

  it('supports dashboard deep-link to profile security section', async () => {
    renderAppAt('/?tab=profile&section=security');

    expect(await screen.findByTestId('profile-content', {}, { timeout: 5000 })).toHaveTextContent('profile:security');
    expect(globalThis.location.pathname).toBe('/');
    expect(globalThis.location.search).toBe('?tab=profile&section=security');
  });

  it('normalizes invalid dashboard deep-link section', async () => {
    renderAppAt('/?tab=profile&section=unknown-section');

    expect(await screen.findByTestId('profile-content', {}, { timeout: 5000 })).toHaveTextContent('profile:info');

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/');
      expect(globalThis.location.search).toBe('?tab=profile');
    });
  });

  it('supports admin deep-link to users tab', async () => {
    renderAppAt('/admin?tab=users');

    expect(await screen.findByTestId('admin-search-placeholder', {}, { timeout: 5000 })).toHaveTextContent("Пошук за username, email або ім'ям...");
    expect(globalThis.location.pathname).toBe('/admin');
    expect(globalThis.location.search).toBe('?tab=users');
  });

  it('normalizes invalid admin deep-link tab to dashboard', async () => {
    renderAppAt('/admin?tab=unknown-tab');

    expect(await screen.findByText('Адміністрування', {}, { timeout: 5000 })).toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/admin');
      expect(globalThis.location.search).toBe('');
    });
  });

  it('handles browser back/forward between dashboard and admin', async () => {
    const user = userEvent.setup();
    renderAppAt('/?tab=profile&section=security');

    expect(await screen.findByTestId('profile-content', {}, { timeout: 5000 })).toHaveTextContent('profile:security');

    const [adminButton] = await screen.findAllByRole('button', { name: /адмін/i });
    await user.click(adminButton);

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/admin');
    });

    await act(async () => {
      globalThis.history.back();
    });

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/');
      expect(globalThis.location.search).toBe('?tab=profile&section=security');
      expect(screen.getByTestId('profile-content')).toHaveTextContent('profile:security');
    });

    await act(async () => {
      globalThis.history.forward();
    });

    await waitFor(() => {
      expect(globalThis.location.pathname).toBe('/admin');
    });
  });

  it.each(['/login', '/register', '/forgot-password'])(
    'redirects authenticated user from guest-only route %s to dashboard',
    async (pathname) => {
      renderAppAt(pathname);

      expect(await screen.findByRole('button', { name: /вийти/i }, { timeout: 5000 })).toBeInTheDocument();
    }
  );

  it('allows authenticated user to open shared verify-email route', async () => {
    renderAppAt('/verify-email');

    expect(await screen.findByText('Токен підтвердження не вказано.', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(globalThis.location.pathname).toBe('/verify-email');
  });
});
