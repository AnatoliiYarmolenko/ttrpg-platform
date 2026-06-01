import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SessionSettingsWidget from '@/features/sessions/components/widgets/SessionSettingsWidget';
import useConfirmDialog from '@/hooks/useConfirmDialog';

vi.mock('@/hooks/useConfirmDialog', () => ({
  default: vi.fn(),
}));

describe('SessionSettingsWidget', () => {
  const mockOpenConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useConfirmDialog.mockReturnValue({
      openConfirm: mockOpenConfirm,
      confirmModalProps: { isOpen: false },
    });
  });

  const defaultSession = {
    id: 1,
    title: 'Test Session',
    description: 'A test session',
    startAt: '2025-01-01T18:00:00Z',
    duration: 180,
    maxPlayers: 5,
    system: 'dnd5e',
    visibility: 'PUBLIC',
    price: 0,
    campaignId: null,
  };

  it('renders nothing if session is not provided', () => {
    const { container } = render(<SessionSettingsWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders session fields with existing data', () => {
    render(<SessionSettingsWidget session={defaultSession} canManageSettings={true} />);

    expect(screen.getByLabelText(/Назва сесії/i)).toHaveValue('Test Session');
    expect(screen.getByLabelText(/Опис/i)).toHaveValue('A test session');
    expect(screen.getByLabelText(/Тривалість/i)).toHaveValue(180);
    expect(screen.getByLabelText(/Макс. гравців/i)).toHaveValue(5);
    expect(screen.getByText(/Ігрова система/i)).toBeInTheDocument();
  });

  it('calls onSave with updated data', async () => {
    const onSaveMock = vi.fn().mockResolvedValue({ success: true });
    render(<SessionSettingsWidget session={defaultSession} onSave={onSaveMock} canManageSettings={true} />);

    const titleInput = screen.getByLabelText(/Назва сесії/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Session Title' } });

    const saveButton = screen.getByRole('button', { name: /Зберегти зміни/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated Session Title' }));
    });
  });

  it('disables inputs when canManageSettings is false', () => {
    render(<SessionSettingsWidget session={defaultSession} canManageSettings={false} />);

    expect(screen.getByLabelText(/Назва сесії/i)).toBeDisabled();
    expect(screen.getByLabelText(/Тривалість/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Лише перегляд/i })).toBeDisabled();
    expect(screen.getByText(/Ви можете переглядати налаштування, але поточний режим доступу не дозволяє їх змінювати/i)).toBeInTheDocument();
  });

  it('shows dangerous options when canDelete is true', () => {
    render(<SessionSettingsWidget session={defaultSession} canManageSettings={true} canDelete={true} />);

    expect(screen.getByRole('button', { name: /Видалити сесію/i })).toBeInTheDocument();
  });

  it('shows regenerate share link button when canManageShareLink is true', () => {
    const onRegenerateShareLinkMock = vi.fn();
    render(
      <SessionSettingsWidget 
        session={defaultSession} 
        canManageSettings={true}
        canManageShareLink={true} 
        currentShareLink="http://link"
        onRegenerateShareLink={onRegenerateShareLinkMock}
      />
    );

    const regenButton = screen.getByRole('button', { name: /Оновити share-посилання/i });
    fireEvent.click(regenButton);

    expect(mockOpenConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Оновити share-посилання?',
      onConfirm: onRegenerateShareLinkMock,
    }));
  });
});
