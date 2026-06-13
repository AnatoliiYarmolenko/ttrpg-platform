import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import useAuthStore from '@/stores/useAuthStore';
import {
  getAdminStats,
  getAdminUsers,
  getAdminCampaigns,
  getAdminSessions,
  deleteAdminCampaign,
  deleteAdminSession,
  banAdminUser,
  unbanAdminUser,
} from '../api/adminApi';

export const useAdminStatsQuery = (options = {}) => {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useAdminUsersQuery = (params, options = {}) => {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => getAdminUsers(params),
    enabled: !!user,
    ...options,
  });
};

export const useAdminCampaignsQuery = (params, options = {}) => {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ['admin', 'campaigns', params],
    queryFn: () => getAdminCampaigns(params),
    enabled: !!user,
    ...options,
  });
};

export const useAdminSessionsQuery = (params, options = {}) => {
  const user = useAuthStore((state) => state.user);
  return useQuery({
    queryKey: ['admin', 'sessions', params],
    queryFn: () => getAdminSessions(params),
    enabled: !!user,
    ...options,
  });
};

export const useAdminMutations = () => {
  const queryClient = useQueryClient();

  const handleMutation = (successMessage, invalidateKeys = []) => ({
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.message || 'Сталася помилка');
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id) => deleteAdminCampaign(id),
    ...handleMutation('Кампанію видалено', [['admin', 'campaigns'], ['admin', 'sessions'], ['admin', 'stats']]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => deleteAdminSession(id),
    ...handleMutation('Сесію видалено', [['admin', 'sessions'], ['admin', 'stats']]),
  });

  const banUserMutation = useMutation({
    mutationFn: (id) => banAdminUser(id),
    ...handleMutation('Користувача забанено', [['admin', 'users'], ['admin', 'stats'], ['admin', 'campaigns'], ['admin', 'sessions']]),
  });

  const unbanUserMutation = useMutation({
    mutationFn: (id) => unbanAdminUser(id),
    ...handleMutation('Користувача розбанено', [['admin', 'users'], ['admin', 'stats'], ['admin', 'campaigns'], ['admin', 'sessions']]),
  });

  return {
    deleteCampaign: deleteCampaignMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
    banUser: banUserMutation.mutateAsync,
    unbanUser: unbanUserMutation.mutateAsync,
  };
};
