import { useState } from 'react';
import PropTypes from 'prop-types';
import Cropper from 'react-easy-crop';
import Button from '@/components/ui/Button';
import { BaseModal } from '@/components/shared';

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
  const titleId = 'avatar-crop-modal-title';

  const handleModalClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    onCancel?.();
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleModalClose}
      closeOnBackdrop={false}
      closeWhileLoading={false}
      isLoading={isLoading}
      labelledBy={titleId}
      panelClassName="max-w-xl"
    >
      <div className="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 id={titleId} className="mb-2 text-lg font-bold text-brand-dark">
          Обрізати аватар
        </h3>

        <p className="mb-6 text-brand-medium">
          Перетягніть фото та виберіть масштаб.
        </p>

        <div className="relative h-[320px] w-full overflow-hidden rounded-xl bg-brand-dark">
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
          <label htmlFor="avatar-crop-zoom" className="mb-2 block text-sm font-medium text-brand-dark">
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
            className="w-full accent-brand-dark"
          />
        </div>

        <div className="mt-6 flex flex-row flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            fullWidth={false}
            className="min-w-[170px]"
            onClick={handleModalClose}
            disabled={isLoading}
          >
            Скасувати
          </Button>
          <Button
            variant="primary"
            fullWidth={false}
            className="min-w-[170px]"
            onClick={onConfirm}
            isLoading={isLoading}
            loadingText="Завантаження..."
          >
            Застосувати
          </Button>
        </div>
      </div>
    </BaseModal>
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
