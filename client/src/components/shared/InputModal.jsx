import { useId, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import BaseModal from './BaseModal';
import PropTypes from 'prop-types';

/**
 * Модалка для введення тексту
 */
export default function InputModal({
  isOpen,
  title = 'Введіть значення',
  message,
  defaultValue = '',
  placeholder = '',
  confirmText = 'Зберегти',
  cancelText = 'Скасувати',
  theme = 'light',
  isLoading = false,
  onConfirm,
  onCancel,
}) {
  const inputRef = useRef(null);
  const titleId = useId();
  const [value, setValue] = useState(defaultValue);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setValue(defaultValue);
    }
  }

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const isDark = theme === 'dark';
  const bgClass = isDark 
    ? 'bg-[#162422] border border-brand-light/10 shadow-black/50' 
    : 'bg-white shadow-xl';
  const titleClass = isDark ? 'text-white' : 'text-brand-dark';
  const textClass = isDark ? 'text-brand-light/80 text-sm' : 'text-brand-medium text-sm';
  const inputClass = isDark 
    ? 'bg-black/30 border-brand-light/10 text-white placeholder-brand-light/30'
    : 'bg-white border-gray-300 text-brand-dark placeholder-gray-400 focus:border-brand-primary focus:ring-brand-primary';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      closeWhileLoading={false}
      isLoading={isLoading}
      initialFocusRef={inputRef}
      labelledBy={titleId}
      panelClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className={`rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 ${bgClass}`}>
        <h3 id={titleId} className={`mb-2 text-lg font-bold ${titleClass}`}>
          {title}
        </h3>

        {message && <p className={`mb-4 ${textClass}`}>{message}</p>}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className={`w-full mb-6 px-3 py-2.5 border rounded-lg focus:outline-none focus:ring-1 ${inputClass}`}
        />

        <div className="mx-auto grid w-full max-w-[380px] grid-cols-2 gap-3">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            size="md"
            fullWidth={false}
            className="w-full shadow-none hover:shadow-none"
          >
            {cancelText}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !value.trim()}
            variant="primary"
            size="md"
            fullWidth={false}
            className="w-full shadow-none hover:shadow-none"
          >
            {isLoading ? 'Зачекайте...' : confirmText}
          </Button>
        </div>
      </form>
    </BaseModal>
  );
}

InputModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.string,
  message: PropTypes.string.isRequired,
  defaultValue: PropTypes.string,
  placeholder: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  theme: PropTypes.oneOf(['light', 'dark']),
  isLoading: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
