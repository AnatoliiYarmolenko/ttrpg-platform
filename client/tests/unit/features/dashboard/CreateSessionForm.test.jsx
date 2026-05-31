import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateSessionForm from '@/features/dashboard/components/widgets/CreateSessionForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import * as sessionApi from '@/features/sessions/api/sessionApi';

vi.mock('@/features/sessions/api/sessionApi', () => ({
  createSession: vi.fn(),
}));

vi.mock('@/stores/useToastStore', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CreateSessionForm', () => {
  let queryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CreateSessionForm {...props} />
      </QueryClientProvider>
    );
  };

  it('renders form elements correctly', () => {
    renderComponent();

    expect(screen.getByLabelText(/Назва сесії/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Опис/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Дата і час/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Макс. гравців/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ціна/i)).toBeInTheDocument();
    
    expect(screen.getByLabelText(/Макс. гравців/i)).toHaveValue(4);
    expect(screen.getByLabelText(/Ціна/i)).toHaveValue(0);
    
    expect(screen.getByRole('button', { name: /Створити/i })).toBeInTheDocument();
  });

  it('validates empty title', async () => {
    renderComponent();

    const submitButton = screen.getByRole('button', { name: /Створити/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Назва сесії обовʼязкова')).toBeInTheDocument();
    });
    expect(toast.error).toHaveBeenCalledWith('Назва сесії обовʼязкова');
    expect(sessionApi.createSession).not.toHaveBeenCalled();
  });

  it('validates short title', async () => {
    renderComponent();

    const titleInput = screen.getByLabelText(/Назва сесії/i);
    fireEvent.change(titleInput, { target: { value: 'ab' } });

    const submitButton = screen.getByRole('button', { name: /Створити/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Назва повинна містити мінімум 3 символи')).toBeInTheDocument();
    });
  });

  it('submits successfully with valid data for a normal session', async () => {
    sessionApi.createSession.mockResolvedValue({ success: true });
    const onSuccessMock = vi.fn();

    renderComponent({ onSuccess: onSuccessMock, initialDate: '2099-01-01' });

    const titleInput = screen.getByLabelText(/Назва сесії/i);
    fireEvent.change(titleInput, { target: { value: 'Epic Adventure' } });

    const submitButton = screen.getByRole('button', { name: /Створити/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(sessionApi.createSession).toHaveBeenCalled();
    });

    const callArgs = sessionApi.createSession.mock.calls[0][0];
    expect(callArgs.title).toBe('Epic Adventure');
    expect(callArgs.visibility).toBe('PUBLIC'); 
    expect(callArgs.isGm).toBe(true);

    expect(toast.success).toHaveBeenCalledWith('Сесію успішно створено');
    expect(onSuccessMock).toHaveBeenCalled();
  });

  it('handles submission error correctly', async () => {
    sessionApi.createSession.mockRejectedValue({
      response: { data: { error: 'Server validation failed' } },
    });

    renderComponent({ initialDate: '2099-01-01' });

    const titleInput = screen.getByLabelText(/Назва сесії/i);
    fireEvent.change(titleInput, { target: { value: 'Epic Adventure' } });

    const submitButton = screen.getByRole('button', { name: /Створити/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Server validation failed');
    });
  });

  it('cancels the form when cancel is clicked', () => {
    const onCancelMock = vi.fn();
    renderComponent({ onCancel: onCancelMock });

    const cancelButton = screen.getByRole('button', { name: /Скасувати/i });
    fireEvent.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalled();
  });

  it('disables role selection if requireGmRole is true', () => {
    renderComponent({ requireGmRole: true });

    expect(screen.queryByText('Я буду Майстром')).not.toBeInTheDocument();
  });

  it('sets visibility options differently for campaign session', () => {
    renderComponent({ campaignId: '123' });

    expect(screen.getByText('Звичайна: доступна в межах кампанії за її стандартними правилами.')).toBeInTheDocument();
  });
});
