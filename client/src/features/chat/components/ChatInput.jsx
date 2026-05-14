import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { Send } from 'lucide-react';

/**
 * ChatInput — поле для вводу повідомлення + кнопка відправки.
 * Disabled при readonly = true.
 * Показує placeholder та валідує довжину.
 */
export default function ChatInput({
  onSend,
  readonly = false,
  isLoading = false,
  placeholder = 'Введіть повідомлення...',
  maxLength = 2000,
  className = '',
}) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);

  const isDisabled = readonly || isLoading || isSending;

  const handleChange = useCallback((e) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setContent(value);
    }
  }, [maxLength]);

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();

    if (!trimmed || isDisabled) {
      return;
    }

    setIsSending(true);

    try {
      await onSend?.(trimmed);
      setContent('');
    } finally {
      setIsSending(false);
    }
  }, [content, isDisabled, onSend]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className={`flex gap-2 items-center ${className}`}>
      <FormField
        as="textarea"
        rows={1}
        placeholder={placeholder}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={isDisabled}
        maxLength={maxLength}
        className="flex-1 mb-0"
        controlClassName="resize-none !py-4 px-3 rounded-xl min-h-[36px] max-h-[120px]"
      />

      <Button
        onClick={handleSend}
        disabled={isDisabled || !content.trim()}
        isLoading={isSending}
        loadingText=""
        size="md"
        variant="primary"
        className="flex-shrink-0 h-[36px] w-[36px] !p-0 flex items-center justify-center rounded-xl"
        title={readonly ? 'Чат недоступний для редагування' : 'Відправити (Ctrl+Enter)'}
      >
        <Send className="w-4 h-4" />
      </Button>
    </div>
  );
}

ChatInput.propTypes = {
  onSend: PropTypes.func.isRequired,
  readonly: PropTypes.bool,
  isLoading: PropTypes.bool,
  placeholder: PropTypes.string,
  maxLength: PropTypes.number,
  className: PropTypes.string,
};
