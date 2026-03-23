import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  getAdminStats,
  getAdminUsers,
  getAdminCampaigns,
  getAdminSessions,
  deleteAdminCampaign,
  deleteAdminSession,
} from '../api/adminApi';

export const useAdminStatsQuery = (options = {}) => {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
};

export const useAdminUsersQuery = (params, options = {}) => {
  return useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => getAdminUsers(params),
    ...options,
  });
};

export const useAdminCampaignsQuery = (params, options = {}) => {
  return useQuery({
    queryKey: ['admin', 'campaigns', params],
    queryFn: () => getAdminCampaigns(params),
    ...options,
  });
};

export const useAdminSessionsQuery = (params, options = {}) => {
  return useQuery({
    queryKey: ['admin', 'sessions', params],
    queryFn: () => getAdminSessions(params),
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
    ...handleMutation('Кампанію видалено', [['admin', 'campaigns'], ['admin', 'stats']]),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (id) => deleteAdminSession(id),
    ...handleMutation('Сесію видалено', [['admin', 'sessions'], ['admin', 'stats']]),
  });

  return {
    deleteCampaign: deleteCampaignMutation.mutateAsync,
    deleteSession: deleteSessionMutation.mutateAsync,
  };
};
