import React, { useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Info,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

const SEVERITY_CONFIG = {
  INFO: { class: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Інфо', icon: Info },
  SUCCESS: { class: 'bg-green-50 border-green-200 text-green-700', label: 'Успіх', icon: BadgeCheck },
  WARNING: { class: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Увага', icon: AlertTriangle },
  ERROR: { class: 'bg-red-50 border-red-200 text-red-700', label: 'Помилка', icon: XCircle },
  CRITICAL: { class: 'bg-red-100 border-red-300 text-red-800', label: 'Критично', icon: ShieldAlert },
  SECURITY: { class: 'bg-purple-50 border-purple-200 text-purple-700', label: 'Безпека', icon: Shield },
};

const STATUS_STYLES = {
  ACTIVE: 'border-l-4 border-l-brand-accent bg-white',
  ARCHIVED: 'border-l-4 border-l-transparent bg-gray-50 opacity-75',
};

/**
 * Елемент списку сповіщень
 *
 * @param {Object} notification - дані сповіщення
 * @param {Function} onMarkAsRead - колбек для позначення як прочитане
 * @param {Function} onArchive - колбек для архівації
 */
export default function NotificationListItem({ notification, onMarkAsRead }) {
  const { id, title, body, severity, status, link, createdAt } = notification;
  const [isProcessing, setIsProcessing] = useState(false);
  const navigate = useNavigate();

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
  const SeverityIcon = config.icon;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.ACTIVE;

  const isActive = status === 'ACTIVE';
  const isArchived = status === 'ARCHIVED';

  const handleClick = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      if (isActive && onMarkAsRead) {
        await onMarkAsRead(id);
      }

      if (link) {
        navigate(link);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e) => {
    const key = e.key || e.keyCode;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      handleClick();
    }
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
      <div className="flex items-center gap-3">
        {/* Severity indicator */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full border flex items-center justify-center ${config.class}`}
          aria-label={config.label}
          title={config.label}
        >
          <SeverityIcon size={20} aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={`text-sm font-semibold text-brand-dark leading-tight ${isActive ? '' : 'font-medium'}`}>
              {title}
            </h4>
            <span className="text-xs text-brand-medium flex-shrink-0">
              {formatTime(createdAt)}
            </span>
          </div>

          <p className="text-sm text-brand-medium mt-1 whitespace-pre-wrap break-words">
            {body}
          </p>
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
};
