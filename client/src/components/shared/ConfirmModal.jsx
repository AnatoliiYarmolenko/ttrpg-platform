import { useEffect, useRef } from 'react';

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
  const overlayRef = useRef(null);
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

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onCancel?.();
  };

  const handleOverlayKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === overlayRef.current) {
      onCancel?.();
    }
  };

  const confirmVariants = {
    primary: 'bg-brand-dark hover:bg-brand-medium text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white',
  };

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95"
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
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border-2 border-brand-dark/20 text-brand-dark hover:bg-brand-dark/5 transition-colors font-medium disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${confirmVariants[variant] || confirmVariants.primary}`}
          >
            {isLoading ? 'Зачекайте...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
