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
      <form onSubmit={handleSubmit} className="rounded-2xl bg-[#162422] border border-brand-light/10 p-6 shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95">
        <h3 id={titleId} className="mb-2 text-lg font-bold text-white">
          {title}
        </h3>

        {message && <p className="mb-4 text-brand-light/80 text-sm">{message}</p>}

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full mb-6 px-3 py-2.5 bg-black/30 border border-brand-light/10 rounded-lg text-white placeholder-brand-light/30 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
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
  isLoading: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
