import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function BaseModal({
  isOpen,
  onClose,
  closeOnEscape = true,
  closeOnBackdrop = true,
  closeWhileLoading = true,
  isLoading = false,
  initialFocusRef,
  labelledBy,
  describedBy,
  panelClassName = '',
  children,
}) {
  const previousActiveElementRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousActiveElementRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    }

    if (!closeOnEscape) {
      return () => {
        document.body.style.overflow = '';
        previousActiveElementRef.current?.focus?.();
      };
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (!closeWhileLoading && isLoading) return;
      onClose?.();
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElementRef.current?.focus?.();
    };
  }, [
    closeOnEscape,
    closeWhileLoading,
    initialFocusRef,
    isLoading,
    isOpen,
    onClose,
  ]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {closeOnBackdrop && (
        <button
          type="button"
          aria-label="Закрити модальне вікно"
          className="absolute inset-0"
          onClick={() => {
            if (!closeWhileLoading && isLoading) return;
            onClose?.();
          }}
        />
      )}

      <dialog
        open
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`relative m-0 w-full border-0 bg-transparent p-0 ${panelClassName}`}
      >
        {children}
      </dialog>
    </div>,
    document.body
  );
}
