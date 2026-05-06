import React from 'react';
import PropTypes from 'prop-types';

const SEVERITY_CONFIG = {
  INFO: { class: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Інфо' },
  SUCCESS: { class: 'bg-green-50 border-green-200 text-green-700', label: 'Успіх' },
  WARNING: { class: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Увага' },
  ERROR: { class: 'bg-red-50 border-red-200 text-red-700', label: 'Помилка' },
  CRITICAL: { class: 'bg-red-100 border-red-300 text-red-800', label: 'Критично' },
  SECURITY: { class: 'bg-purple-50 border-purple-200 text-purple-700', label: 'Безпека' },
};

const STATUS_STYLES = {
  UNREAD: 'border-l-4 border-l-brand-accent bg-white',
  READ: 'border-l-4 border-l-transparent bg-brand-light/5',
  ARCHIVED: 'border-l-4 border-l-transparent bg-gray-50 opacity-75',
};

/**
 * Елемент списку сповіщень
 *
 * @param {Object} notification - дані сповіщення
 * @param {Function} onMarkAsRead - колбек для позначення як прочитане
 * @param {Function} onArchive - колбек для архівації
 */
export default function NotificationListItem({ notification, onMarkAsRead, onArchive }) {
  const { id, title, body, severity, status, link, createdAt } = notification;

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.READ;

  const isUnread = status === 'UNREAD';
  const isArchived = status === 'ARCHIVED';

  const handleClick = () => {
    if (isUnread && onMarkAsRead) {
      onMarkAsRead(id);
    }
    if (link) {
      globalThis.location.href = link;
    }
  };

  const handleKeyDown = (e) => {
    const key = e.key || e.keyCode;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleMarkAsRead = (e) => {
    e.stopPropagation();
    if (onMarkAsRead) onMarkAsRead(id);
  };

  const handleArchive = (e) => {
    e.stopPropagation();
    if (onArchive) onArchive(id);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'щойно';
    if (diffMins < 60) return `${diffMins} хв тому`;
    if (diffHours < 24) return `${diffHours} год тому`;
    if (diffDays < 7) return `${diffDays} дн тому`;
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  return (
    <div
      className={`
        relative rounded-xl border border-brand-light/30 p-4 cursor-pointer
        transition-all duration-200 hover:shadow-md hover:border-brand-light/50
        ${statusStyle}
        ${isArchived ? 'grayscale' : ''}
      `}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex gap-3">
        {/* Severity indicator */}
        <div className={`flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${config.class}`}>
          {config.label}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-semibold text-brand-dark leading-tight ${isUnread ? '' : 'font-medium'}`}>
              {title}
            </h4>
            <span className="text-xs text-brand-medium flex-shrink-0">
              {formatTime(createdAt)}
            </span>
          </div>

          <p className="text-sm text-brand-medium mt-1 line-clamp-2">
            {body}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3">
            {isUnread && (
              <button
                onClick={handleMarkAsRead}
                className="px-2 py-1 text-xs font-medium rounded-lg bg-brand-light/20 text-brand-dark hover:bg-brand-light/30 transition-colors"
              >
                Прочитано
              </button>
            )}

            {!isArchived && (
              <button
                onClick={handleArchive}
                className="px-2 py-1 text-xs font-medium rounded-lg text-brand-medium hover:bg-brand-light/10 transition-colors"
              >
                Архів
              </button>
            )}

            {link && (
              <span className="text-xs text-brand-accent ml-auto">
                Перейти →
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

NotificationListItem.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    body: PropTypes.string,
    severity: PropTypes.string,
    status: PropTypes.string,
    link: PropTypes.string,
    createdAt: PropTypes.string,
  }).isRequired,
  onMarkAsRead: PropTypes.func,
  onArchive: PropTypes.func,
};
