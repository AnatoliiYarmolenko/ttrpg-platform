import { useQuery } from '@tanstack/react-query';
import { getMyCampaigns } from '@/features/campaigns/api/campaignApi';
import { getMySessions } from '@/features/sessions/api/sessionApi';
import useAuthStore from '@/stores/useAuthStore';

export const useMyCampaignsQuery = (role = 'all') => {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: ['dashboard', 'campaigns', userId, role],
    queryFn: async () => {
      const response = await getMyCampaigns(role);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch campaigns');
      }
      return response.data || [];
    },
  });
};

export const useMySessionsQuery = (params = {}) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useQuery({
    queryKey: ['dashboard', 'games', userId, params],
    queryFn: async () => {
      const response = await getMySessions(params);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch sessions');
      }
      return response.data || [];
    },
  });
};
