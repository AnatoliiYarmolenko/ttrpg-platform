import { useInfiniteQuery } from '@tanstack/react-query';
import { searchCampaigns, searchSessions } from '../api/searchApi';

const cleanParams = (baseFilters, pageParam) => {
  const params = { ...baseFilters, offset: pageParam };
  Object.keys(params).forEach((key) => {
    if (params[key] === '' || params[key] === null || params[key] === false) {
      delete params[key];
    }
  });
  return params;
};

export const useSearchCampaignsQuery = (baseFilters, options = {}) => {
  return useInfiniteQuery({
    queryKey: ['search', 'campaigns', baseFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await searchCampaigns(cleanParams(baseFilters, pageParam));
      return res;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + (page?.campaigns?.length || 0), 0);
    },
    ...options,
  });
};

export const useSearchSessionsQuery = (baseFilters, options = {}) => {
  return useInfiniteQuery({
    queryKey: ['search', 'sessions', baseFilters],
    queryFn: async ({ pageParam = 0 }) => {
      const res = await searchSessions(cleanParams(baseFilters, pageParam));
      return res;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + (page?.sessions?.length || 0), 0);
    },
    ...options,
  });
};
