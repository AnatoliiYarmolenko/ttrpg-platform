import { create } from 'zustand';
import { searchCampaigns, searchSessions } from '@/features/search/api/searchApi';
import { apiAction } from '@/utils/apiAction';
import useCalendarStore from './useCalendarStore';
import { VIEW_MODES } from './dashboardConstants';

const getDefaultSearchFilters = () => ({
  q: '',
  system: '',
  dateFrom: '',
  dateTo: '',
  searchQuery: '',
  minPrice: null,
  maxPrice: null,
  hasAvailableSlots: false,
  oneShot: false,
  sortBy: 'date',
  limit: 20,
  offset: 0,
});

const getDefaultCampaignResults = () => ({
  campaigns: [],
  total: 0,
  hasMore: false,
});

const getDefaultSessionResults = () => ({
  sessions: [],
  total: 0,
  hasMore: false,
});

const resolveCalendarContext = (context = {}) => ({
  currentMonth: context.currentMonth || new Date(),
  viewMode: context.viewMode || VIEW_MODES.SEARCH,
});

const useSearchStore = create((set, get) => ({
  searchActiveTab: 'sessions',
  campaignResults: getDefaultCampaignResults(),
  sessionResults: getDefaultSessionResults(),
  searchFilters: getDefaultSearchFilters(),
  hasSearched: false,
  isSearchLoading: false,
  error: null,

  setSearchActiveTab: (tab) => set({ searchActiveTab: tab }),

  setSearchFilters: (filters) => {
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters, offset: 0 },
    }));
  },

  setHasSearched: (value) => set({ hasSearched: Boolean(value) }),

  resetSearchFilters: async (context = {}) => {
    const searchFilters = getDefaultSearchFilters();
    set({
      searchFilters,
      hasSearched: false,
      campaignResults: getDefaultCampaignResults(),
      sessionResults: getDefaultSessionResults(),
    });

    const { currentMonth, viewMode } = resolveCalendarContext(context);

    await useCalendarStore.getState().fetchCalendarStats({
      currentMonth,
      viewMode,
      searchFilters,
      hasSearched: false,
    });
  },

  clearSearchResults: () =>
    set({
      campaignResults: getDefaultCampaignResults(),
      sessionResults: getDefaultSessionResults(),
    }),

  executeSearch: async (context = {}) => {
    set({ hasSearched: true });
    const { searchActiveTab } = get();
    const { currentMonth, viewMode } = resolveCalendarContext(context);

    await useCalendarStore.getState().fetchCalendarStats({
      currentMonth,
      viewMode,
      searchFilters: get().searchFilters,
      hasSearched: true,
    });

    if (searchActiveTab === 'campaigns') {
      await get().searchCampaignsAction();
    } else {
      await get().searchSessionsAction();
    }
  },

  searchCampaignsAction: async (params = {}) => {
    const { searchFilters } = get();
    const searchParams = {
      q: params.q ?? searchFilters.q,
      system: params.system ?? searchFilters.system,
      limit: params.limit ?? searchFilters.limit,
      offset: params.offset ?? searchFilters.offset,
      sortBy: params.sortBy ?? searchFilters.sortBy ?? 'newest',
    };

    Object.keys(searchParams).forEach((key) => {
      if (searchParams[key] === '' || searchParams[key] === null) {
        delete searchParams[key];
      }
    });

    const result = await apiAction(set, {
      loadingKey: 'isSearchLoading',
      apiCall: () => searchCampaigns(searchParams),
      onSuccess: (data) =>
        set({
          campaignResults: {
            campaigns:
              searchParams.offset > 0
                ? [...get().campaignResults.campaigns, ...data.campaigns]
                : data.campaigns,
            total: data.total,
            hasMore: data.hasMore,
          },
        }),
      defaultError: 'Помилка при пошуку кампаній',
    });

    return result.success ? result.data : null;
  },

  searchSessionsAction: async (params = {}) => {
    const { searchFilters } = get();
    const searchParams = {
      q: params.q ?? searchFilters.q,
      system: params.system ?? searchFilters.system,
      dateFrom: params.dateFrom ?? searchFilters.dateFrom,
      dateTo: params.dateTo ?? searchFilters.dateTo,
      minPrice: params.minPrice ?? searchFilters.minPrice,
      maxPrice: params.maxPrice ?? searchFilters.maxPrice,
      hasAvailableSlots: params.hasAvailableSlots ?? searchFilters.hasAvailableSlots,
      oneShot: params.oneShot ?? searchFilters.oneShot,
      limit: params.limit ?? searchFilters.limit,
      offset: params.offset ?? searchFilters.offset,
      sortBy: params.sortBy ?? searchFilters.sortBy,
    };

    Object.keys(searchParams).forEach((key) => {
      if (
        searchParams[key] === '' ||
        searchParams[key] === null ||
        searchParams[key] === false
      ) {
        delete searchParams[key];
      }
    });

    const result = await apiAction(set, {
      loadingKey: 'isSearchLoading',
      apiCall: () => searchSessions(searchParams),
      onSuccess: (data) =>
        set({
          sessionResults: {
            sessions:
              searchParams.offset > 0
                ? [...get().sessionResults.sessions, ...data.sessions]
                : data.sessions,
            total: data.total,
            hasMore: data.hasMore,
          },
        }),
      defaultError: 'Помилка при пошуку сесій',
    });

    return result.success ? result.data : null;
  },

  loadMoreSearchResults: async () => {
    const { searchActiveTab, campaignResults, sessionResults } = get();
    const newOffset =
      searchActiveTab === 'campaigns'
        ? campaignResults.campaigns.length
        : sessionResults.sessions.length;

    set((state) => ({
      searchFilters: { ...state.searchFilters, offset: newOffset },
    }));

    if (searchActiveTab === 'campaigns') {
      return get().searchCampaignsAction({ offset: newOffset });
    }

    return get().searchSessionsAction({ offset: newOffset });
  },

  clearError: () => set({ error: null }),

  reset: () => {
    set({
      searchActiveTab: 'sessions',
      campaignResults: getDefaultCampaignResults(),
      sessionResults: getDefaultSessionResults(),
      searchFilters: getDefaultSearchFilters(),
      hasSearched: false,
      isSearchLoading: false,
      error: null,
    });
  },
}));

export default useSearchStore;