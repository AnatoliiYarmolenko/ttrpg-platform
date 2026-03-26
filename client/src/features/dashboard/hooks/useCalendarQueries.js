import { useQuery } from '@tanstack/react-query';
import { getCalendarStats, getSessionsByDayFiltered } from '@/features/sessions/api/sessionApi';
import useAuthStore from '@/stores/useAuthStore';
import { normalizeTimeZoneValue } from '@/utils/timeZone';

const buildSearchFilters = (searchFilters = {}) => {
  const filters = {};
  if (searchFilters.system) filters.system = searchFilters.system;
  if (searchFilters.dateFrom) filters.dateFrom = searchFilters.dateFrom;
  if (searchFilters.dateTo) filters.dateTo = searchFilters.dateTo;
  if (searchFilters.q) filters.searchQuery = searchFilters.q;
  if (searchFilters.searchQuery) filters.searchQuery = searchFilters.searchQuery;
  return Object.keys(filters).length > 0 ? filters : null;
};

const resolveScope = (viewMode, hasSearched) => {
  if (viewMode === 'my-games') return 'user';
  if (viewMode === 'search' && hasSearched) return 'search';
  return 'global';
};

const getBrowserTimeZone = () => {
  try {
    return normalizeTimeZoneValue(Intl.DateTimeFormat().resolvedOptions().timeZone || null);
  } catch {
    return null;
  }
};

export const useCalendarStatsQuery = ({ currentMonth, viewMode, searchFilters, hasSearched }) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const monthDate = currentMonth instanceof Date && !isNaN(currentMonth) ? currentMonth : new Date();
  const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: ['calendar', userId, monthKey, viewMode, searchFilters, hasSearched, timeZone],
    queryFn: async () => {
      const scope = resolveScope(viewMode, hasSearched);
      
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

export const useDaySessionsQuery = ({ date, viewMode, searchFilters, hasSearched }) => {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const timeZone = getBrowserTimeZone();

  return useQuery({
    queryKey: ['sessions', 'daily', userId, date, viewMode, searchFilters, hasSearched, timeZone],
    queryFn: async () => {
      if (!date) return [];
      const scope = resolveScope(viewMode, hasSearched);
      const filters = scope === 'search' ? buildSearchFilters(searchFilters) : null;
      
      const res = await getSessionsByDayFiltered(date, scope, filters, timeZone);
      if (!res.success) throw new Error(res.error || 'Failed to fetch day sessions');
      return res.data || [];
    },
    enabled: !!date,
  });
};
