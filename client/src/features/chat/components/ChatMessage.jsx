import React from 'react';
import PropTypes from 'prop-types';
import UserAvatar from '@/components/shared/UserAvatar';

/**
 * ChatMessage — окреме USER повідомлення з аватаром, ім'ям, часом та вмістом.
 * Показує статус pending/failed якщо реалізовується optimistic send.
 */

// Простий утиліт для форматування часу без залежностей
function formatTimeAgo(dateStr) {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    const now = new Date();
    const secondsAgo = Math.floor((now - date) / 1000);

    if (secondsAgo < 60) return 'щойно';
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)} хв тому`;
    if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)} г тому`;
    if (secondsAgo < 604800) return `${Math.floor(secondsAgo / 86400)} д тому`;

    // Для старіших повідомлень показуємо дату
    return date.toLocaleDateString('uk-UA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function useRelativeTime(dateStr) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    // Оновлювати таймер кожну хвилину
    const intervalId = setInterval(() => {
      setTick((t) => t + 1);
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  return tick >= 0 ? formatTimeAgo(dateStr) : '';
}

export default function ChatMessage({
  message,
  isCurrentUser = false,
  className = '',
}) {
  const time = useRelativeTime(message?.createdAt);

  if (!message) {
    return null;
  }

  const {
    id,
    author,
    content,
    pending,
    status,
  } = message;

  const authorName = author?.displayName || author?.username || 'Невідомий';
  const authorAvatar = author?.avatarUrl || null;

  const statusStyles = {
    pending: 'opacity-60',
    failed: 'opacity-75 border-l-4 border-l-red-400',
  };

  return (
    <div
      className={`flex gap-2.5 px-4 py-2 transition-colors ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'} ${statusStyles[status] || ''} ${className}`}
      data-message-id={id}
      data-client-message-id={message.clientMessageId || null}
    >
      <UserAvatar
        src={authorAvatar}
        name={authorName}
        size="sm"
        className="flex-shrink-0 mt-0.5"
      />

      <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} flex-1 min-w-0`}>
        {!isCurrentUser && (
          <span className="text-[11px] font-bold text-brand-medium/80 mb-1 ml-1">
            {authorName}
          </span>
        ) }

        <div className={`relative max-w-[90%] px-3.5 py-2 rounded-xl shadow-sm 
          ${isCurrentUser 
            ? 'bg-brand-dark text-white' 
            : 'bg-gray-100 border border-brand-light/10 text-brand-dark'}`}
        >
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {content}
          </p>
          
          <div className={`mt-1 flex items-center gap-1 ${isCurrentUser ? 'justify-end text-white/60' : 'justify-start text-brand-medium/70'}`}>
            <span className="text-[10px]">
              {time}
            </span>
            {isCurrentUser && pending && <span className="text-[10px] animate-pulse">...</span>}
          </div>
        </div>

        {status === 'failed' && (
           <span className="text-[10px] text-red-500 mt-1 font-semibold px-1">
             Помилка відправки
           </span>
        )}
      </div>
    </div>
  );
}

ChatMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    chatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    type: PropTypes.string,
    content: PropTypes.string.isRequired,
    author: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      username: PropTypes.string,
      displayName: PropTypes.string,
      avatarUrl: PropTypes.string,
    }),
    createdAt: PropTypes.string,
    clientMessageId: PropTypes.string,
    pending: PropTypes.bool,
    status: PropTypes.oneOf(['pending', 'failed', null]),
  }).isRequired,
  isCurrentUser: PropTypes.bool,
  className: PropTypes.string,
};
