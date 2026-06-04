import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markManyAsRead,
} from '../api/notificationApi';

export const notificationQueryKeys = {
  all: ['notifications'],
  list: (params = {}) => ['notifications', 'list', params],
  unreadCount: () => ['notifications', 'unread-count'],
};

export const useNotificationsQuery = (params = {}, enabled = true) => {
  const { status, limit = 20, offset = 0 } = params;

  return useQuery({
    queryKey: notificationQueryKeys.list({ status, limit, offset }),
    queryFn: async () => {
      const res = await getNotifications({ status, limit, offset });

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch notifications');
      }

      return res.data;
    },
    enabled,
  });
};

export const useUnreadCountQuery = (enabled = true) => {
  return useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: async () => {
      const res = await getUnreadCount();

      if (!res.success) {
        throw new Error(res.error || 'Failed to fetch unread count');
      }

      return res.data.count;
    },
    enabled,
    refetchInterval: 60 * 1000,
    staleTime: 30 * 1000,
  });
};

export const useNotificationCountQuery = useUnreadCountQuery;

export const useNotificationMutations = () => {
  const queryClient = useQueryClient();

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
  };

  const invalidateUnreadCount = () => {
    queryClient.invalidateQueries({
      queryKey: notificationQueryKeys.unreadCount(),
    });
  };

  const markAsReadMutation = useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      invalidateUnreadCount();
      invalidateNotifications();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive notification');
    },
  });

  const markManyAsReadMutation = useMutation({
    mutationFn: markManyAsRead,
    onSuccess: (res) => {
      invalidateUnreadCount();
      invalidateNotifications();
      toast.success(`${res.data?.count || 'Notifications'} archived`);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive notifications');
    },
  });

  return {
    markAsReadMutation,
    markManyAsReadMutation,
    invalidateNotifications,
    invalidateUnreadCount,
  };
};
