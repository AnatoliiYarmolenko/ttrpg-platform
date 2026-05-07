import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import DashboardCard from '@/components/ui/DashboardCard';
import { BackButton } from '@/components/shared';
import useDashboardStore from '@/stores/useDashboardStore';
import { PANEL_MODES } from '@/features/dashboard/constants';
import CreateSessionForm from './CreateSessionForm';
import NotificationList from '@/features/notifications/components/NotificationList';
import NotificationBadge from '@/features/notifications/components/NotificationBadge';
import {
  useNotificationsQuery,
  useNotificationCountQuery,
  useNotificationMutations,
} from '@/features/notifications/hooks/useNotificationQueries';

const FILTER_OPTIONS = [
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

  const { data, isLoading } = useNotificationsQuery({
    status: filter,
    limit,
    offset: 0,
  });
  const { data: activeCount = 0 } = useNotificationCountQuery();

  // Extract notifications data early (needed for effects and render)
  const notifications = data?.notifications || [];
  const pagination = data?.pagination;

  const { markAsReadMutation, archiveMutation } = useNotificationMutations();

  const handleBackToNotifications = () => {
    setRightPanelMode(PANEL_MODES.LIST);
  };

  const handleCreateSuccess = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'home', 'next-relevant-session'] });
    await queryClient.invalidateQueries({ queryKey: ['dashboard', 'games'] });
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

  return (
    <DashboardCard
      title={
        <div className="flex items-center gap-2">
          Сповіщення
          <NotificationBadge count={activeCount} size="sm" />
        </div>
      }
    >
      <div className="flex flex-col h-full">
        {/* Filter tabs */}
        <div className="flex gap-1 mb-4 p-1 bg-brand-light/10 rounded-xl">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key)}
              className={`
                flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors
                ${filter === option.key
                  ? 'bg-white text-brand-dark shadow-sm'
                  : 'text-brand-medium hover:text-brand-dark hover:bg-brand-light/10'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            hasMore={pagination?.hasMore}
            onLoadMore={handleLoadMore}
            onMarkAsRead={handleMarkAsRead}
            onArchive={handleArchive}
            filter={filter}
          />
        </div>
      </div>
    </DashboardCard>
  );
}
