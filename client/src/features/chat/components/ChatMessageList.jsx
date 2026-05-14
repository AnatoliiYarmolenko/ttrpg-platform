import React, { useMemo, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ChatMessage from './ChatMessage';
import ChatSystemMessage from './ChatSystemMessage';
import { Loader2, AlertCircle } from 'lucide-react';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';

/**
 * ChatMessageList — список повідомлень з прокруткою.
 * Автоматично скролиться вниз при приходженні нових повідомлень.
 * Підтримує фільтрацію по типу (USER, SYSTEM).
 */
export default function ChatMessageList({
  messages = [],
  isLoading = false,
  hasError = false,
  errorMessage = null,
  className = '',
}) {
  const containerRef = useRef(null);
  const prevMessageCountRef = useRef(messages.length);
  const currentUser = useAuthStore(selectUser);
  const currentUserId = currentUser?.id;

  const messageElements = useMemo(
    () => messages.map((message) => {
      const isSystem = message.type === 'SYSTEM';
      const key = `${message.id || 'new'}-${message.clientMessageId || 'msg'}`;

      if (isSystem) {
        return <ChatSystemMessage key={key} message={message} />;
      }

      const isCurrentUser = currentUserId && (message.authorId === currentUserId || message.author?.id === currentUserId);

      return (
        <ChatMessage
          key={key}
          message={message}
          isCurrentUser={isCurrentUser}
        />
      );
    }),
    [messages, currentUserId]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const shouldAutoScroll = prevMessageCountRef.current < messages.length;
    if (shouldAutoScroll) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 0);
    }

    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  if (isLoading && messages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Loader2 className="w-6 h-6 text-brand-light animate-spin" />
      </div>
    );
  }

  if (hasError && messages.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-full gap-3 ${className}`}>
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-red-600 font-medium">
          {errorMessage || 'Помилка завантаження чату'}
        </p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-brand-light text-sm">
          Поки що немає повідомлень. Починайте розмову!
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-1 overflow-y-auto overflow-x-hidden h-full min-h-0 ${className}`}
    >
      {messageElements}
      {isLoading && (
        <div className="flex justify-center p-4">
          <Loader2 className="w-4 h-4 text-brand-light animate-spin" />
        </div>
      )}
    </div>
  );
}

ChatMessageList.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      chatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      type: PropTypes.oneOf(['USER', 'SYSTEM']),
      content: PropTypes.string.isRequired,
      author: PropTypes.object,
      createdAt: PropTypes.string,
      clientMessageId: PropTypes.string,
      pending: PropTypes.bool,
      status: PropTypes.string,
    })
  ),
  isLoading: PropTypes.bool,
  hasError: PropTypes.bool,
  errorMessage: PropTypes.string,
  className: PropTypes.string,
};
