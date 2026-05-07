import React from 'react';
import PropTypes from 'prop-types';
import NotificationListItem from './NotificationListItem';
import NotificationEmptyState from './NotificationEmptyState';

/**
 * Список сповіщень з підтримкою скролу та пагінації
 *
 * @param {Object[]} notifications - масив сповіщень
 * @param {boolean} isLoading - чи завантажуються дані
 * @param {boolean} hasMore - чи є ще дані для завантаження
 * @param {Function} onLoadMore - колбек для завантаження наступної сторінки
 * @param {Function} onMarkAsRead - колбек для позначення як прочитане
 * @param {Function} onArchive - колбек для архівації
 * @param {string} filter - поточний фільтр для empty state
 */
export default function NotificationList({
  notifications = [],
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onArchive,
  filter = 'ACTIVE',
}) {
  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-brand-medium font-medium">Завантаження...</span>
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return <NotificationEmptyState filter={filter} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {notifications.map((notification) => (
        <NotificationListItem
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onArchive={onArchive}
        />
      ))}

      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className="
            mt-2 py-3 px-4 rounded-xl
            bg-brand-light/10 text-brand-dark font-medium
            hover:bg-brand-light/20
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
            flex items-center justify-center gap-2
          "
        >
          {isLoading ? (
            <span>Завантаження...</span>
          ) : (
            'Завантажити ще'
          )}
        </button>
      )}
    </div>
  );
}

NotificationList.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  hasMore: PropTypes.bool,
  onLoadMore: PropTypes.func,
  onMarkAsRead: PropTypes.func,
  onArchive: PropTypes.func,
  filter: PropTypes.string,
};

NotificationList.defaultProps = {
  notifications: [],
  isLoading: false,
  hasMore: false,
  onLoadMore: undefined,
  onMarkAsRead: undefined,
  onArchive: undefined,
  filter: 'ACTIVE',
};
