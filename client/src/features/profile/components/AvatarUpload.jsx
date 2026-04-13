import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useProfileMutations } from '../hooks/useProfileQueries';
import Button from '@/components/ui/Button';
import { UserAvatar } from '@/components/shared';
import { toast } from '@/stores/useToastStore';
import AvatarCropModal from './AvatarCropModal';
import { getCroppedImageFile } from '../utils/cropImage';

export default function AvatarUpload({ currentAvatarUrl, username, onUpdate }) {
  const fileInputRef = useRef(null);
  const { uploadAvatar, deleteAvatar, uploadAvatarStatus, deleteAvatarStatus } = useProfileMutations();
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [sourceImageUrl, setSourceImageUrl] = useState('');
  const [sourceFileName, setSourceFileName] = useState('avatar');
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const uploading = uploadAvatarStatus || deleteAvatarStatus || isCropping;

  const resetCropState = () => {
    if (sourceImageUrl) {
      URL.revokeObjectURL(sourceImageUrl);
    }

    setCropModalOpen(false);
    setSourceImageUrl('');
    setSourceFileName('avatar');
    setCroppedAreaPixels(null);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валідація
    if (!file.type.startsWith('image/')) {
      toast.error('Виберіть зображення');
      return;
    }
    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error('Файл занадто великий (макс. 5MB)');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSourceImageUrl(objectUrl);
    setSourceFileName(file.name || 'avatar');
    setCropModalOpen(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCropConfirm = async () => {
    if (!sourceImageUrl || !croppedAreaPixels) {
      toast.error('Оберіть область для аватара');
      return;
    }

    try {
      setIsCropping(true);
      const croppedFile = await getCroppedImageFile(sourceImageUrl, croppedAreaPixels, sourceFileName);
      const result = await uploadAvatar(croppedFile);

      if (onUpdate && result?.profile) {
        onUpdate(result.profile);
      }

      resetCropState();
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Не вдалося оновити аватар');
    } finally {
      setIsCropping(false);
    }
  };

  const handleDelete = async () => {
    if (!currentAvatarUrl) return;
    try {
      const result = await deleteAvatar();
      if (onUpdate && result?.profile) {
        onUpdate(result.profile);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Не вдалося видалити аватар');
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Аватар */}
      <div className="relative">
        <UserAvatar
          src={currentAvatarUrl}
          name={username}
          size="lg"
        />
        
        {/* Кнопка редагування */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 px-2 py-1 bg-brand-accent rounded-lg flex items-center justify-center text-brand-dark text-xs font-bold shadow-md hover:bg-amber-500 transition-colors"
        >
          {uploading ? '...' : 'Змінити'}
        </button>
      </div>

      {/* Прихований input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Кнопка видалення */}
      {currentAvatarUrl && (
        <Button
          onClick={handleDelete}
          disabled={uploading}
          variant="danger"
          fullWidth={false}
          className="text-sm py-2"
        >
          Видалити
        </Button>
      )}

      <p className="text-xs text-brand-medium text-center">
        JPG, PNG, GIF або WebP. Макс. 5MB
      </p>

      <AvatarCropModal
        key={sourceImageUrl || 'avatar-crop'}
        isOpen={cropModalOpen}
        imageSrc={sourceImageUrl}
        isLoading={uploading}
        onCropAreaChange={setCroppedAreaPixels}
        onCancel={resetCropState}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}

AvatarUpload.propTypes = {
  currentAvatarUrl: PropTypes.string,
  username: PropTypes.string,
  onUpdate: PropTypes.func,
};
