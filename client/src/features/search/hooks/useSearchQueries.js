import { useInfiniteQuery } from '@tanstack/react-query';
import { searchCampaigns, searchSessions } from '../api/searchApi';

const SESSION_PARAM_KEYS = [
  'q',
  'system',
  'ownerUsername',
  'onlyMyParticipation',
  'dateFrom',
  'dateTo',
  'minPrice',
  'maxPrice',
  'hasAvailableSlots',
  'oneShot',
  'sortBy',
  'limit',
];

const CAMPAIGN_PARAM_KEYS = [
  'q',
  'system',
  'ownerUsername',
  'onlyMyParticipation',
  'sortBy',
  'limit',
];

const sanitizeParams = (params) => {
  const sanitized = { ...params };
  Object.keys(sanitized).forEach((key) => {
    if (sanitized[key] === '' || sanitized[key] === null || sanitized[key] === false) {
      delete sanitized[key];
    }
  });
  return sanitized;
};

const pickFilterParams = (baseFilters, allowedKeys, pageParam) => {
  const picked = allowedKeys.reduce((acc, key) => {
    if (Object.hasOwn(baseFilters, key)) {
      acc[key] = baseFilters[key];
    }
    return acc;
  }, {});

  return sanitizeParams({
    ...picked,
    offset: pageParam,
  });
};

const unwrapSearchResponse = (response) => {
  if (response?.success === false) {
    throw new Error(response.error || 'Search request failed');
  }

  return response?.data ?? { campaigns: [], sessions: [], total: 0, hasMore: false };
};

export const buildSessionSearchParams = (baseFilters = {}, pageParam = 0) => (
  pickFilterParams(baseFilters, SESSION_PARAM_KEYS, pageParam)
);

export const buildCampaignSearchParams = (baseFilters = {}, pageParam = 0) => (
  pickFilterParams(baseFilters, CAMPAIGN_PARAM_KEYS, pageParam)
);

export const useSearchCampaignsQuery = (baseFilters = {}, options = {}) => {
  return useInfiniteQuery({
    queryKey: ['search', 'campaigns', sanitizeParams(baseFilters)],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const res = await searchCampaigns(buildCampaignSearchParams(baseFilters, pageParam));
      return unwrapSearchResponse(res);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + (page?.campaigns?.length || 0), 0);
    },
    ...options,
  });
};

export const useSearchSessionsQuery = (baseFilters = {}, options = {}) => {
  return useInfiniteQuery({
    queryKey: ['search', 'sessions', sanitizeParams(baseFilters)],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) => {
      const res = await searchSessions(buildSessionSearchParams(baseFilters, pageParam));
      return unwrapSearchResponse(res);
    },
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage?.hasMore) return undefined;
      return allPages.reduce((acc, page) => acc + (page?.sessions?.length || 0), 0);
    },
    ...options,
  });
};
