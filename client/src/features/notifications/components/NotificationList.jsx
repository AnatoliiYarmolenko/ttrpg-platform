import React from 'react';
import PropTypes from 'prop-types';
import NotificationListItem from './NotificationListItem';
import NotificationEmptyState from './NotificationEmptyState';
import { SkeletonNotification } from '@/components/shared';
import Button from '@/components/ui/Button';

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
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  onMarkAsRead,
  onArchive,
  filter = 'ACTIVE',
}) {
  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <SkeletonNotification key={i} />)}
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
        <Button
          onClick={onLoadMore}
          isLoading={isLoadingMore}
          loadingText="Завантаження..."
          variant="outline"
          fullWidth
          className="mt-2 shadow-none hover:shadow-none"
        >
          Завантажити ще
        </Button>
      )}
    </div>
  );
}

NotificationList.propTypes = {
  notifications: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  isLoadingMore: PropTypes.bool,
  hasMore: PropTypes.bool,
  onLoadMore: PropTypes.func,
  onMarkAsRead: PropTypes.func,
  onArchive: PropTypes.func,
  filter: PropTypes.string,
};

NotificationList.defaultProps = {
  notifications: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: false,
  onLoadMore: undefined,
  onMarkAsRead: undefined,
  onArchive: undefined,
  filter: 'ACTIVE',
};
