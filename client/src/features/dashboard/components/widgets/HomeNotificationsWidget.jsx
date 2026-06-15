import React, { useState } from 'react';
import { CheckCheck, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import DashboardCard from '@/components/ui/DashboardCard';
import { BackButton, SegmentedToggle } from '@/components/shared';
import useDashboardStore from '@/stores/useDashboardStore';
import { PANEL_MODES } from '@/features/dashboard/constants';
import CreateSessionForm from './CreateSessionForm';
import NotificationList from '@/features/notifications/components/NotificationList';
import NotificationBadge from '@/features/notifications/components/NotificationBadge';
import {
  useNotificationsQuery,
  useUnreadCountQuery,
  useNotificationMutations,
} from '@/features/notifications/hooks/useNotificationQueries';
import NotificationEmptyState from '@/features/notifications/components/NotificationEmptyState';
import {
  invalidateNextRelevantSessionQuery,
  invalidateDashboardGamesQuery,
} from '@/lib/queryInvalidation';

const NOTIFICATION_FILTER_OPTIONS = [
  { key: 'ACTIVE', label: 'Активні' },
  { key: 'ARCHIVED', label: 'Архів' },
];

export default function HomeNotificationsWidget() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('ACTIVE');
  const [limit, setLimit] = useState(10);

  const selectedDate = useDashboardStore((state) => state.selectedDate);
  const rightPanelMode = useDashboardStore((state) => state.rightPanelMode);
  const setRightPanelMode = useDashboardStore((state) => state.setRightPanelMode);

  const { data, isLoading, isFetching } = useNotificationsQuery({
    status: filter,
    limit,
    offset: 0,
  });
  const isLoadingMore = isFetching && !isLoading;
  const { data: activeCount = 0 } = useUnreadCountQuery();

  const notifications = data?.notifications || [];
  const pagination = data?.pagination;

  const { markAsReadMutation, archiveMutation, markManyAsReadMutation } = useNotificationMutations();

  const activeNotificationIds = notifications
    .filter((n) => n.status === 'ACTIVE')
    .map((n) => n.id);

  const handleMarkAllAsRead = async () => {
    if (activeNotificationIds.length === 0) return;
    await markManyAsReadMutation.mutateAsync(activeNotificationIds);
  };

  const handleBackToNotifications = () => {
    setRightPanelMode(PANEL_MODES.LIST);
  };

  const handleCreateSuccess = async () => {
    await invalidateNextRelevantSessionQuery(queryClient);
    await invalidateDashboardGamesQuery(queryClient);
    handleBackToNotifications();
  };

  const handleMarkAsRead = async (id) => {
    await markAsReadMutation.mutateAsync(id);
  };

  const handleArchive = async (id) => {
    await archiveMutation.mutateAsync(id);
  };

  const handleLoadMore = () => {
    setLimit((prev) => prev + 10);
  };



  if (rightPanelMode === PANEL_MODES.CREATE) {
    return (
      <DashboardCard
        title="Створити сесію"
        actions={<BackButton label="Назад" onClick={handleBackToNotifications} variant="dark" />}
      >
        <CreateSessionForm
          initialDate={selectedDate}
          onSuccess={handleCreateSuccess}
          onCancel={handleBackToNotifications}
        />
      </DashboardCard>
    );
  }

  const isEmpty = !isLoading && notifications.length === 0;

  const markAllButton = filter === 'ACTIVE' && activeNotificationIds.length > 0 ? (
    <button
      onClick={handleMarkAllAsRead}
      disabled={markManyAsReadMutation.isPending}
      title="Позначити всі як прочитані"
      className="p-1.5 rounded-lg text-brand-medium hover:text-brand-dark hover:bg-brand-light/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {markManyAsReadMutation.isPending
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : <CheckCheck className="w-4 h-4" />
      }
    </button>
  ) : null;

  return (
    <DashboardCard
      title={
        <div className="flex items-center gap-2">
          Сповіщення
          <NotificationBadge count={activeCount} size="sm" />
        </div>
      }
      actions={markAllButton}
      noScroll
    >
      <SegmentedToggle
        options={NOTIFICATION_FILTER_OPTIONS}
        value={filter}
        onChange={setFilter}
        className="mb-4 flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto min-h-0 -mx-2 px-2 relative">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <NotificationEmptyState filter={filter} />
          </div>
        )}
        {!isEmpty && (
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={pagination?.hasMore}
            onLoadMore={handleLoadMore}
            onMarkAsRead={handleMarkAsRead}
            onArchive={handleArchive}
            filter={filter}
          />
        )}
      </div>
    </DashboardCard>
  );
}
