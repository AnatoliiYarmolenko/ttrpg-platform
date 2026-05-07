import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useNotificationSSE from '@/features/notifications/hooks/useNotificationSSE';
import useNotificationStore from '@/stores/useNotificationStore';
import useAuthStore, { selectIsAuthenticated } from '@/stores/useAuthStore';
import { toast } from '@/stores/useToastStore';
import { notificationQueryKeys } from '@/features/notifications/hooks/useNotificationQueries';

const updateQueryDataForNotification = (queryClient, queryKey, notification, limit) => {
  let wasAlreadyPresent = false;

  queryClient.setQueryData(queryKey, (oldData) => {
    if (!oldData) {
      return oldData;
    }

    const existingNotifications = oldData.notifications || [];
    const alreadyExists = existingNotifications.some((item) => item.id === notification.id);
    if (alreadyExists) {
      wasAlreadyPresent = true;
      return oldData;
    }

    const nextNotifications = [notification, ...existingNotifications].slice(0, limit);
    const previousTotal = Number.isFinite(oldData.pagination?.total)
      ? oldData.pagination.total
      : existingNotifications.length;
    const total = previousTotal + 1;

    return {
      ...oldData,
      notifications: nextNotifications,
      pagination: {
        ...oldData.pagination,
        total,
        limit,
        offset: 0,
        hasMore: total > nextNotifications.length,
      },
    };
  });

  return wasAlreadyPresent;
};

const processNotificationQueries = (queryClient, notification) => {
  let wasAlreadyPresent = false;

  queryClient.getQueryCache().findAll({ queryKey: ['notifications', 'list'] })
    .forEach((query) => {
      const queryKey = query.queryKey;
      const params = queryKey && queryKey.length > 2 ? queryKey[2] : {};
      const status = params?.status;
      const offset = Number.isFinite(params?.offset) ? params.offset : 0;
      const limit = Number.isFinite(params?.limit) ? params.limit : 20;

      if (offset !== 0) {
        return;
      }

      if (status && status !== 'ACTIVE') {
        return;
      }

      const isPresent = updateQueryDataForNotification(queryClient, queryKey, notification, limit);
      if (isPresent) {
        wasAlreadyPresent = true;
      }
    });

  return wasAlreadyPresent;
};

export default function GlobalNotificationProvider() {
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const lastProcessedIdRef = useRef(null);

  useNotificationSSE(isAuthenticated);

  const liveNotifications = useNotificationStore((state) => state.liveNotifications);
  const clearLiveNotifications = useNotificationStore((state) => state.clearLiveNotifications);

  useEffect(() => {
    if (!isAuthenticated) {
      clearLiveNotifications();
    }
  }, [isAuthenticated, clearLiveNotifications]);

  useEffect(() => {
    if (liveNotifications.length === 0) {
      return;
    }

    const lastProcessedId = lastProcessedIdRef.current;
    const lastProcessedIndex = lastProcessedId
      ? liveNotifications.findIndex((notification) => notification.id === lastProcessedId)
      : -1;

    const newNotifications = lastProcessedIndex === -1
      ? liveNotifications
      : liveNotifications.slice(0, lastProcessedIndex);

    if (newNotifications.length === 0) {
      return;
    }

    newNotifications
      .slice()
      .reverse()
      .forEach((notification) => {
        const wasAlreadyPresent = processNotificationQueries(queryClient, notification);

        if (!wasAlreadyPresent) {
          queryClient.setQueryData(notificationQueryKeys.unreadCount(), (oldCount) => {
            if (!Number.isFinite(oldCount)) {
              return 1;
            }
            return oldCount + 1;
          });
        }
      });

    lastProcessedIdRef.current = newNotifications[0].id;
  }, [liveNotifications, queryClient]);

  useEffect(() => {
    const lastNotification = liveNotifications[0];
    if (lastNotification && (lastNotification.severity === 'CRITICAL' || lastNotification.severity === 'SECURITY')) {
      toast.error(lastNotification.title, {
        description: lastNotification.body,
        duration: 10000,
      });
    }
  }, [liveNotifications]);

  return null;
}
