import { useEffect, useRef } from 'react';
import Button from '@/components/ui/Button';

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

  // Trap focus inside modal
  useEffect(() => {
    if (isOpen && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmVariant = variant === 'danger' ? 'danger' : 'secondary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Закрити модальне вікно"
        className="absolute inset-0"
        onClick={onCancel}
      />
      <dialog
        open
        aria-labelledby="confirm-modal-title"
        className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95"
      >
        <h3
          id="confirm-modal-title"
          className="text-lg font-bold text-brand-dark mb-2"
        >
          {title}
        </h3>

        {message && (
          <p className="text-brand-medium mb-6">{message}</p>
        )}

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            size="md"
            fullWidth={false}
            className="shadow-none hover:shadow-none"
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
            className="shadow-none hover:shadow-none"
          >
            {isLoading ? 'Зачекайте...' : confirmText}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
