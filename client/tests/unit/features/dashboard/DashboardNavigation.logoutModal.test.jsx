import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DashboardNavigation from '@/features/dashboard/components/DashboardNavigation';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('@/stores/useAuthStore', () => {
  const useAuthStore = (selector) => {
    const state = { user: { role: 'ADMIN' } };
    return typeof selector === 'function' ? selector(state) : state;
  };

  return {
    __esModule: true,
    default: useAuthStore,
    selectIsAdmin: (state) => state.user?.role === 'ADMIN',
  };
});

vi.mock('@/components/ui/NavButton', () => ({
  default: ({ label, onClick }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock('@/components/shared', async () => {
  const actual = await vi.importActual('@/components/shared');
  return {
    ...actual,
    BrandLogo: () => <div>Brand</div>,
  };
});

describe('DashboardNavigation logout modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens confirm modal and calls onLogout callback on confirm', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn().mockResolvedValue(undefined);

    render(
      <DashboardNavigation
        currentView="home"
        onNavigate={vi.fn()}
        user={{ username: 'test-user' }}
        onLogout={onLogout}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Вийти' })[0]);

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Вийти' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('does not call onLogout when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <DashboardNavigation
        currentView="home"
        onNavigate={vi.fn()}
        user={{ username: 'test-user' }}
        onLogout={onLogout}
      />
    );

    await user.click(screen.getAllByRole('button', { name: 'Вийти' })[0]);

    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Скасувати' }));

    expect(onLogout).not.toHaveBeenCalled();
  });
});
