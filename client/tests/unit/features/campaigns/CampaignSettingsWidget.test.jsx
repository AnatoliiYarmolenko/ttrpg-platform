import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CampaignSettingsWidget from '@/features/campaigns/components/widgets/CampaignSettingsWidget';
import useConfirmDialog from '@/hooks/useConfirmDialog';

vi.mock('@/hooks/useConfirmDialog', () => ({
  default: vi.fn(),
}));

describe('CampaignSettingsWidget', () => {
  const mockOpenConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useConfirmDialog.mockReturnValue({
      openConfirm: mockOpenConfirm,
      confirmModalProps: { isOpen: false },
    });
  });

  const defaultCampaign = {
    id: 1,
    title: 'Test Campaign',
    description: 'A test',
    system: 'dnd5e',
    visibility: 'PUBLIC',
    status: 'ACTIVE',
    ownerId: 10,
    members: [
      { userId: 10, user: { displayName: 'Owner' } },
      { userId: 20, user: { displayName: 'Player 1' } },
    ]
  };

  it('renders nothing if campaign is not provided', () => {
    const { container } = render(<CampaignSettingsWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders campaign fields with existing data', () => {
    render(<CampaignSettingsWidget campaign={defaultCampaign} />);

    expect(screen.getByLabelText(/Назва кампанії/i)).toHaveValue('Test Campaign');
    expect(screen.getByLabelText(/Опис/i)).toHaveValue('A test');
    expect(screen.getByText(/Ігрова система/i)).toBeInTheDocument();
  });

  it('calls onSave with updated title', async () => {
    const onSaveMock = vi.fn().mockResolvedValue({ success: true });
    render(<CampaignSettingsWidget campaign={defaultCampaign} onSave={onSaveMock} />);

    const titleInput = screen.getByLabelText(/Назва кампанії/i);
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    const saveButton = screen.getByRole('button', { name: /Зберегти зміни/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onSaveMock).toHaveBeenCalledWith({ title: 'Updated Title' });
    });
  });

  it('disables inputs when campaign is finished', () => {
    render(<CampaignSettingsWidget campaign={{ ...defaultCampaign, status: 'FINISHED' }} />);

    expect(screen.getByLabelText(/Назва кампанії/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Зберегти зміни/i })).toBeDisabled();
    expect(screen.getByText('Кампанія завершена. Налаштування заблоковані, нові сесії та вступ недоступні.')).toBeInTheDocument();
  });

  it('opens confirm modal for leaving campaign', () => {
    const onLeaveMock = vi.fn();
    render(<CampaignSettingsWidget campaign={defaultCampaign} myRole="PLAYER" onLeave={onLeaveMock} />);

    const leaveButton = screen.getByRole('button', { name: /Покинути кампанію/i });
    fireEvent.click(leaveButton);

    expect(mockOpenConfirm).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Покинути кампанію?',
      onConfirm: onLeaveMock,
    }));
  });

  it('shows regenerate share link button when canManageShareLink is true', () => {
    const onRegenerateShareLinkMock = vi.fn();
    render(
      <CampaignSettingsWidget 
        campaign={defaultCampaign} 
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

  it('shows dangerous options when canTransferOwnership is true', () => {
    render(<CampaignSettingsWidget campaign={defaultCampaign} canTransferOwnership={true} />);

    expect(screen.getByRole('button', { name: /Завершити кампанію/i })).toBeInTheDocument();
    
    const transferButton = screen.getByRole('button', { name: /Передати права кампанії/i });
    expect(transferButton).toBeDisabled();
  });
});
