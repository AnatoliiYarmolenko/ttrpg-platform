import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  getCroppedImageFile: vi.fn(),
}));

vi.mock('@/features/profile/hooks/useProfileQueries', () => ({
  useProfileMutations: () => ({
    uploadAvatar: mocks.uploadAvatar,
    deleteAvatar: mocks.deleteAvatar,
    uploadAvatarStatus: false,
    deleteAvatarStatus: false,
  }),
}));

vi.mock('@/stores/useToastStore', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock('@/features/profile/utils/cropImage', () => ({
  getCroppedImageFile: mocks.getCroppedImageFile,
}));

vi.mock('@/features/profile/components/AvatarCropModal', () => ({
  default: ({ isOpen, imageSrc, isLoading, onCancel, onConfirm, onCropAreaChange }) => {
    if (!isOpen) return null;

    return (
      <div role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <h2 id="crop-title">Обрізати аватар</h2>
        <p>Перетягніть фото та виберіть масштаб.</p>
        <button
          type="button"
          onClick={() => onCropAreaChange({ x: 10, y: 12, width: 120, height: 120 })}
        >
          Обрати область
        </button>
        <button type="button" onClick={onCancel} disabled={isLoading}>
          Скасувати
        </button>
        <button type="button" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Завантаження...' : 'Застосувати'}
        </button>
        {imageSrc && <img src={imageSrc} alt="Preview" />}
      </div>
    );
  },
}));

import AvatarUpload from '@/features/profile/components/AvatarUpload';
import { toast } from '@/stores/useToastStore';
import { getCroppedImageFile } from '@/features/profile/utils/cropImage';

describe('AvatarUpload', () => {
  let objectUrlCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    objectUrlCounter = 0;

    mocks.uploadAvatar.mockResolvedValue({
      success: true,
      profile: {
        avatarUrl: '/uploads/avatars/avatar_123.webp',
        username: 'testuser',
      },
    });
    mocks.deleteAvatar.mockResolvedValue({
      success: true,
      profile: {
        avatarUrl: null,
        username: 'testuser',
      },
    });
    mocks.getCroppedImageFile.mockResolvedValue(
      new File(['cropped'], 'avatar.webp', { type: 'image/webp' })
    );

    URL.createObjectURL = vi.fn(() => `blob:mock-url-${++objectUrlCounter}`);
    URL.revokeObjectURL = vi.fn();
  });

  const renderUpload = (props = {}) => render(<AvatarUpload username="testuser" {...props} />);

  const getFileInput = () => document.querySelector('input[type="file"]');

  it('renders the primary avatar actions', () => {
    renderUpload();

    expect(screen.getByRole('button', { name: /Змінити/i })).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG, GIF або WebP. Макс. 5MB/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Видалити/i })).not.toBeInTheDocument();
  });

  it('uploads a valid image after crop selection', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<AvatarUpload username="testuser" onUpdate={onUpdate} />);

    const file = new File(['avatar-bytes'], 'profile-avatar.png', { type: 'image/png' });
    await user.upload(getFileInput(), file);

    const dialog = await screen.findByRole('dialog', { name: /Обрізати аватар/i });
    expect(within(dialog).getByRole('img', { name: /Preview/i })).toHaveAttribute(
      'src',
      'blob:mock-url-1'
    );

    await user.click(within(dialog).getByRole('button', { name: /Обрати область/i }));
    await user.click(within(dialog).getByRole('button', { name: /Застосувати/i }));

    await waitFor(() => {
      expect(getCroppedImageFile).toHaveBeenCalledWith(
        'blob:mock-url-1',
        { x: 10, y: 12, width: 120, height: 120 },
        'profile-avatar.png'
      );
      expect(mocks.uploadAvatar).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: '/uploads/avatars/avatar_123.webp' })
      );
      expect(toast.error).not.toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-1');
    });
  });

  it('allows canceling the crop and cleans up the preview URL', async () => {
    const user = userEvent.setup();
    renderUpload();

    const file = new File(['avatar-bytes'], 'profile-avatar.png', { type: 'image/png' });
    await user.upload(getFileInput(), file);

    const dialog = await screen.findByRole('dialog', { name: /Обрізати аватар/i });
    await user.click(within(dialog).getByRole('button', { name: /Скасувати/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url-1');
    });
  });

  it('rejects non-image files before opening the crop modal', () => {
    renderUpload();

    const file = new File(['plain text'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(getFileInput(), { target: { files: [file] } });

    expect(toast.error).toHaveBeenCalledWith('Виберіть зображення');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('rejects oversized images before opening the crop modal', async () => {
    const user = userEvent.setup();
    renderUpload();

    const file = new File(['x'.repeat(6 * 1024 * 1024)], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 });

    await user.upload(getFileInput(), file);

    expect(toast.error).toHaveBeenCalledWith('Файл занадто великий (макс. 5MB)');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('reports a crop selection error when the user confirms too early', async () => {
    const user = userEvent.setup();
    renderUpload();

    await user.upload(
      getFileInput(),
      new File(['avatar-bytes'], 'profile-avatar.png', { type: 'image/png' })
    );

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Застосувати/i }));

    expect(toast.error).toHaveBeenCalledWith('Оберіть область для аватара');
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
  });

  it('shows a cropping error if the crop helper fails', async () => {
    mocks.getCroppedImageFile.mockRejectedValueOnce(new Error('Bad crop'));

    const user = userEvent.setup();
    renderUpload();

    await user.upload(
      getFileInput(),
      new File(['avatar-bytes'], 'profile-avatar.png', { type: 'image/png' })
    );

    const dialog = await screen.findByRole('dialog', { name: /Обрізати аватар/i });
    await user.click(within(dialog).getByRole('button', { name: /Обрати область/i }));
    await user.click(within(dialog).getByRole('button', { name: /Застосувати/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Bad crop');
      expect(mocks.uploadAvatar).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog', { name: /Обрізати аватар/i })).toBeInTheDocument();
    });
  });

  it('surfaces upload failures from the backend', async () => {
    mocks.uploadAvatar.mockRejectedValueOnce({
      response: { data: { error: 'Upload failed' } },
    });

    const user = userEvent.setup();
    renderUpload();

    await user.upload(
      getFileInput(),
      new File(['avatar-bytes'], 'profile-avatar.png', { type: 'image/png' })
    );

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Обрати область/i }));
    await user.click(within(dialog).getByRole('button', { name: /Застосувати/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Upload failed');
      expect(screen.getByRole('dialog', { name: /Обрізати аватар/i })).toBeInTheDocument();
    });
  });

  it('deletes the current avatar and notifies the parent', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <AvatarUpload
        currentAvatarUrl="/uploads/avatars/avatar_123.webp"
        username="testuser"
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: /Видалити/i }));

    await waitFor(() => {
      expect(mocks.deleteAvatar).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ avatarUrl: null, username: 'testuser' })
      );
    });
  });

  it('surfaces deletion failures from the backend', async () => {
    mocks.deleteAvatar.mockRejectedValueOnce({
      response: { data: { error: 'Delete failed' } },
    });

    const user = userEvent.setup();
    render(
      <AvatarUpload
        currentAvatarUrl="/uploads/avatars/avatar_123.webp"
        username="testuser"
      />
    );

    await user.click(screen.getByRole('button', { name: /Видалити/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Delete failed');
    });
  });
});
