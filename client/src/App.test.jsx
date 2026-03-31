import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import App from './App';
import { useCsrfInit } from './hooks/useCsrfInit';

vi.mock('./hooks/useCsrfInit', () => ({
  useCsrfInit: vi.fn(),
}));

vi.mock('./routes/AppRoutes', () => ({
  default: () => <div data-testid="app-routes">App Routes</div>,
}));

vi.mock('./components/ui/toast/ToastViewport', () => ({
  default: () => <div data-testid="toast-viewport" />,
}));

vi.mock('./components/shared/FullPageLoader', () => ({
  default: ({ text }) => <div data-testid="full-page-loader">{text}</div>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loader while csrf init is in progress', () => {
    vi.mocked(useCsrfInit).mockReturnValue({
      isInitialized: false,
      error: null,
    });

    render(<App />);

    expect(screen.getByTestId('full-page-loader')).toBeInTheDocument();
    expect(screen.getByText('Завантаження ініціативи...')).toBeInTheDocument();
  });

  it('renders application routes when csrf init is complete', () => {
    vi.mocked(useCsrfInit).mockReturnValue({
      isInitialized: true,
      error: null,
    });

    render(<App />);

    expect(screen.getByTestId('app-routes')).toBeInTheDocument();
    expect(screen.getByTestId('toast-viewport')).toBeInTheDocument();
  });
});
