import React, { useRef } from 'react';
import { useProfileMutations } from '../hooks/useProfileQueries';
import Button from '@/components/ui/Button';
import { UserAvatar } from '@/components/shared';
import { toast } from '@/stores/useToastStore';

export default function AvatarUpload({ currentAvatarUrl, username, onUpdate }) {
  const fileInputRef = useRef(null);
  const { uploadAvatar, deleteAvatar, uploadAvatarStatus, deleteAvatarStatus } = useProfileMutations();
  const uploading = uploadAvatarStatus || deleteAvatarStatus;

  const handleFileSelect = async (e) => {
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

    try {
      const result = await uploadAvatar(file);
      if (onUpdate && result?.profile) {
        onUpdate(result.profile);
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || error?.message || 'Не вдалося оновити аватар');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
          className="absolute bottom-0 right-0 px-2 py-1 bg-[#F1B24A] rounded-lg flex items-center justify-center text-[#164A41] text-xs font-bold shadow-md hover:bg-[#e0a33f] transition-colors"
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

      <p className="text-xs text-[#4D774E] text-center">
        JPG, PNG або GIF. Макс. 5MB
      </p>
    </div>
  );
}
