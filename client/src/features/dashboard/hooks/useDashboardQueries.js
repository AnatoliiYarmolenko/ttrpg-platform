import { useQuery } from '@tanstack/react-query';
import { getMyCampaigns } from '@/features/campaigns/api/campaignApi';
import { getMySessions } from '@/features/sessions/api/sessionApi';

export const useMyCampaignsQuery = (role = 'all') => {
  return useQuery({
    queryKey: ['dashboard', 'campaigns', role],
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
  return useQuery({
    queryKey: ['dashboard', 'games', params],
    queryFn: async () => {
      const response = await getMySessions(params);
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch sessions');
      }
      return response.data || [];
    },
  });
};
