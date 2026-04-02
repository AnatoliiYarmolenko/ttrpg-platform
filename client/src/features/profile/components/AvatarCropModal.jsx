import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Cropper from 'react-easy-crop';
import Button from '@/components/ui/Button';

export default function AvatarCropModal({
  isOpen,
  imageSrc,
  onCancel,
  onConfirm,
  onCropAreaChange,
  isLoading,
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (e) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel?.();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <dialog
        open
        aria-modal="true"
        aria-labelledby="avatar-crop-modal-title"
        className="m-0 w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl sm:p-6"
      >
        <h3 id="avatar-crop-modal-title" className="mb-2 text-lg font-bold text-[#164A41]">
          Обрізати аватар
        </h3>

        <p className="mb-4 text-sm text-[#4D774E]">
          Перетягніть фото та виберіть масштаб.
        </p>

        <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-[#0F2E29]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            minZoom={1}
            maxZoom={3}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, croppedAreaPixels) => onCropAreaChange(croppedAreaPixels)}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="avatar-crop-zoom" className="mb-2 block text-sm font-medium text-[#164A41]">
            Масштаб
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-[#164A41]"
          />
        </div>

        <div className="mt-6 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            fullWidth={false}
            className="px-4 py-2"
            onClick={onCancel}
            disabled={isLoading}
          >
            Скасувати
          </Button>
          <Button
            fullWidth={false}
            className="px-4 py-2"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Завантаження..."
          >
            Застосувати
          </Button>
        </div>
      </dialog>
    </div>
  );
}

AvatarCropModal.propTypes = {
  isOpen: PropTypes.bool,
  imageSrc: PropTypes.string,
  onCancel: PropTypes.func,
  onConfirm: PropTypes.func,
  onCropAreaChange: PropTypes.func,
  isLoading: PropTypes.bool,
};
