import { useId, useRef } from 'react';
import Button from '@/components/ui/Button';
import BaseModal from './BaseModal';

/**
 * Модалка підтвердження — замість window.confirm().
 * Підтримує спільну кольорову тему проекту.
 *
 * Використання:
 *   <ConfirmModal
 *     isOpen={showModal}
 *     title="Видалити учасника?"
 *     message="Цю дію не можна буде скасувати."
 *     confirmText="Видалити"
 *     cancelText="Скасувати"
 *     variant="danger"
 *     onConfirm={handleDelete}
 *     onCancel={() => setShowModal(false)}
 *   />
 */
export default function ConfirmModal({
  isOpen,
  title = 'Підтвердження',
  message,
  confirmText = 'Підтвердити',
  cancelText = 'Скасувати',
  variant = 'primary',
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);
  const titleId = useId();

  if (!isOpen) return null;

  const confirmVariant = variant === 'danger' ? 'danger' : 'primary';
  const modalActionButtonClass = 'w-full';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeWhileLoading={false}
      isLoading={isLoading}
      initialFocusRef={confirmBtnRef}
      labelledBy={titleId}
      panelClassName="max-w-md"
    >
      <div className="rounded-2xl bg-white p-6 shadow-xl animate-in fade-in zoom-in-95">
        <h3 id={titleId} className="mb-2 text-lg font-bold text-brand-dark">
          {title}
        </h3>

        {message && <p className="mb-6 text-brand-medium">{message}</p>}

        <div className="mx-auto grid w-full max-w-[380px] grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            size="md"
            fullWidth={false}
            className={`${modalActionButtonClass} shadow-none hover:shadow-none`}
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            variant={confirmVariant}
            size="md"
            fullWidth={false}
            className={`${modalActionButtonClass} shadow-none hover:shadow-none`}
          >
            {isLoading ? 'Зачекайте...' : confirmText}
          </Button>
        </div>
      </div>
    </BaseModal>
  );
}
