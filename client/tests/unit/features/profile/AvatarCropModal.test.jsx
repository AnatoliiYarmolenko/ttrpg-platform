import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarCropModal from '@/features/profile/components/AvatarCropModal';

vi.mock('react-easy-crop', () => ({
  default: function MockCropper({ crop, zoom, onCropChange, onZoomChange, onCropComplete, image }) {
    return (
      <div
        data-testid="cropper-mock"
        data-image={image}
        data-crop-x={crop?.x}
        data-crop-y={crop?.y}
        data-zoom={zoom}
      >
        <button type="button" onClick={() => onCropChange?.({ x: 18, y: 24 })}>
          Move crop
        </button>
        <button type="button" onClick={() => onZoomChange?.(2.25)}>
          Zoom in
        </button>
        <button
          type="button"
          data-testid="simulate-crop-complete"
          onClick={() => onCropComplete?.({ x: 0, y: 0, width: 100 }, { x: 10, y: 10, width: 120, height: 120 })}
        >
          Simulate Crop
        </button>
      </div>
    );
  },
}));

describe('AvatarCropModal', () => {
  const mockProps = {
    isOpen: true,
    imageSrc: 'data:image/png;base64,test',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    onCropAreaChange: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AvatarCropModal {...mockProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when imageSrc is missing', () => {
    const { container } = render(
      <AvatarCropModal {...mockProps} imageSrc="" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal content when isOpen and imageSrc are provided', () => {
    render(<AvatarCropModal {...mockProps} />);

    expect(screen.getByText('Обрізати аватар')).toBeInTheDocument();
    expect(screen.getByText(/Перетягніть фото та виберіть масштаб/)).toBeInTheDocument();
    expect(screen.getByTestId('cropper-mock')).toBeInTheDocument();
  });

  it('exposes the zoom slider and starts from default value', () => {
    render(<AvatarCropModal {...mockProps} />);

    const slider = screen.getByRole('slider', { name: /Масштаб/i });
    expect(slider).toHaveValue('1');
  });

  it('calls onCancel when Cancel button is clicked and resets the next open state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AvatarCropModal {...mockProps} />);

    const slider = screen.getByRole('slider', { name: /Масштаб/i });
    fireEvent.change(slider, { target: { value: '2.5' } });
    await user.click(screen.getByRole('button', { name: /Скасувати/i }));

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);

    rerender(<AvatarCropModal {...mockProps} isOpen={false} />);
    rerender(<AvatarCropModal {...mockProps} />);

    expect(screen.getByRole('slider', { name: /Масштаб/i })).toHaveValue('1');
  });

  it('calls onConfirm when Apply button is clicked', async () => {
    const user = userEvent.setup();
    render(<AvatarCropModal {...mockProps} />);

    const applyButton = screen.getByRole('button', { name: /Застосувати/i });
    await user.click(applyButton);

    expect(mockProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when isLoading is true', () => {
    render(<AvatarCropModal {...mockProps} isLoading />);

    const applyButton = screen.getByRole('button', { name: /Завантаження/i });
    expect(applyButton).toBeDisabled();

    expect(screen.getByRole('button', { name: /Скасувати/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Завантаження/i })).toBeInTheDocument();
  });


  it('closes modal on Escape key when not loading', async () => {
    const user = userEvent.setup();
    render(<AvatarCropModal {...mockProps} />);

    await user.keyboard('{Escape}');

    expect(mockProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape key when isLoading is true', async () => {
    const user = userEvent.setup();
    render(<AvatarCropModal {...mockProps} isLoading />);

    await user.keyboard('{Escape}');

    expect(mockProps.onCancel).not.toHaveBeenCalled();
  });

  it('has correct accessibility attributes', () => {
    render(<AvatarCropModal {...mockProps} />);

    const modalContainer = screen.getByRole('dialog');
    expect(modalContainer).toHaveAttribute('aria-modal', 'true');
    expect(modalContainer).toHaveAttribute('aria-labelledby', 'avatar-crop-modal-title');

    const title = screen.getByText('Обрізати аватар');
    expect(title).toHaveAttribute('id', 'avatar-crop-modal-title');
  });

  it('calls onCropAreaChange when Cropper emits onCropComplete', async () => {
    const user = userEvent.setup();
    render(<AvatarCropModal {...mockProps} />);

    const simulateButton = screen.getByTestId('simulate-crop-complete');
    await user.click(simulateButton);

    expect(mockProps.onCropAreaChange).toHaveBeenCalledTimes(1);
    expect(mockProps.onCropAreaChange).toHaveBeenCalledWith({ x: 10, y: 10, width: 120, height: 120 });
  });
});
