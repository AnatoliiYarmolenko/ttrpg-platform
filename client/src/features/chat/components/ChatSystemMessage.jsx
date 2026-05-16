import React from 'react';
import PropTypes from 'prop-types';

/**
 * ChatSystemMessage — системне повідомлення (статус сесії, членство, тощо).
 * За замовчуванням це світло-сіра, центрована строчка.
 */
export default function ChatSystemMessage({
  message,
  className = '',
}) {
  if (!message?.content) {
    return null;
  }

  return (
    <div
      className={`flex justify-center px-4 py-3 ${className}`}
      data-message-id={message.id}
    >
      <div className="bg-gray-100 border border-gray-200 rounded-full px-4 py-2 max-w-xs">
        <p className="text-xs text-gray-600 font-medium text-center">
          {message.content}
        </p>
      </div>
    </div>
  );
}

ChatSystemMessage.propTypes = {
  message: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    chatId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    type: PropTypes.string,
    content: PropTypes.string.isRequired,
    createdAt: PropTypes.string,
  }).isRequired,
  className: PropTypes.string,
};
