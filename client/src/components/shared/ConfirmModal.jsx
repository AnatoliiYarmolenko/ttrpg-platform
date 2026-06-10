import { useId, useRef } from 'react';
import Button from '@/components/ui/Button';
import BaseModal from './BaseModal';
import PropTypes from 'prop-types';


export default function ConfirmModal({
  isOpen,
  title = 'Підтвердження',
  message,
  confirmText = 'Підтвердити',
  cancelText = 'Скасувати',
  variant = 'primary',
  theme = 'light',
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  const confirmBtnRef = useRef(null);
  const titleId = useId();

  if (!isOpen) return null;

  const confirmVariant = variant === 'danger' ? 'danger' : 'primary';
  const modalActionButtonClass = 'w-full';

  const isDark = theme === 'dark';
  const bgClass = isDark 
    ? 'bg-[#162422] border border-brand-light/10 shadow-black/50' 
    : 'bg-white shadow-xl';
  const titleClass = isDark ? 'text-white' : 'text-brand-dark';
  const textClass = isDark ? 'text-brand-light/80' : 'text-brand-medium';

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
      <div className={`rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 ${bgClass}`}>
        <h3 id={titleId} className={`mb-2 text-lg font-bold ${titleClass}`}>
          {title}
        </h3>

        {message && <p className={`mb-6 ${textClass}`}>{message}</p>}

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

ConfirmModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  variant: PropTypes.oneOf(['primary', 'danger']),
  theme: PropTypes.oneOf(['light', 'dark']),
  isLoading: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
