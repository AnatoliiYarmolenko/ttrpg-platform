import { useQuery } from '@tanstack/react-query';
import { getCalendarStats, getSessionsByDayFiltered } from '@/features/sessions/api/sessionApi';
import useAuthStore from '@/stores/useAuthStore';
import { normalizeTimeZoneValue } from '@/utils/timeZone';
import { SEARCH_TABS } from '@/stores/useSearchStore';

const buildSearchFilters = (searchFilters = {}) => {
  const sessionFilters = searchFilters?.[SEARCH_TABS.SESSIONS] || searchFilters;
  const filters = {};
  if (sessionFilters.system) filters.system = sessionFilters.system;
  if (sessionFilters.dateFrom) filters.dateFrom = sessionFilters.dateFrom;
  if (sessionFilters.dateTo) filters.dateTo = sessionFilters.dateTo;
  if (sessionFilters.q) filters.searchQuery = sessionFilters.q;
  if (sessionFilters.searchQuery) filters.searchQuery = sessionFilters.searchQuery;
  return Object.keys(filters).length > 0 ? filters : null;
};

const resolveScope = (viewMode) => {
  if (viewMode === 'my-games') return 'user';
  if (viewMode === 'search') return 'search';
  return 'global';
};

const getBrowserTimeZone = () => {
  try {
    return normalizeTimeZoneValue(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
  } catch {
    return null;
  }
};

export const useCalendarStatsQuery = ({ currentMonth, viewMode, searchFilters }) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const monthDate = currentMonth instanceof Date && !Number.isNaN(currentMonth.getTime()) 
    ? currentMonth 
    : new Date();  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: ['calendar', userId, monthKey, viewMode, searchFilters, timeZone],
    queryFn: async () => {
      const scope = resolveScope(viewMode);
      
      const params = { month: `${monthKey}-01`, scope, ...(timeZone ? { timeZone } : {}) };
      if (scope === 'search') {
        const filters = buildSearchFilters(searchFilters);
        if (filters) params.filters = filters;
      }
      
      const res = await getCalendarStats(params);
      if (!res.success) throw new Error(res.error || 'Failed to fetch calendar stats');
      return res.data || {};
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useDaySessionsQuery = ({ date, viewMode, searchFilters }) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: ['sessions', 'daily', userId, date, viewMode, searchFilters, timeZone],
    queryFn: async () => {
      if (!date) return [];
      const scope = resolveScope(viewMode);
      const filters = scope === 'search' ? buildSearchFilters(searchFilters) : null;
      
      const res = await getSessionsByDayFiltered(date, scope, filters, timeZone);
      if (!res.success) throw new Error(res.error || 'Failed to fetch day sessions');
      return res.data || [];
    },
    enabled: !!date,
  });
};
