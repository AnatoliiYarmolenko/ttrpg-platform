import { create } from 'zustand';

export const SEARCH_TABS = Object.freeze({
  SESSIONS: 'sessions',
  CAMPAIGNS: 'campaigns',
});

const getDefaultSessionFilters = () => ({
  q: '',
  system: '',
  ownerUsername: '',
  onlyMyParticipation: false,
  dateFrom: '',
  dateTo: '',
  minPrice: null,
  maxPrice: null,
  hasAvailableSlots: false,
  oneShot: false,
  sortBy: 'date',
  limit: 20,
});

const getDefaultCampaignFilters = () => ({
  q: '',
  system: '',
  ownerUsername: '',
  onlyMyParticipation: false,
  sortBy: 'newest',
  limit: 20,
});

const getDefaultSearchFilters = () => ({
  [SEARCH_TABS.SESSIONS]: getDefaultSessionFilters(),
  [SEARCH_TABS.CAMPAIGNS]: getDefaultCampaignFilters(),
});

const useSearchStore = create((set) => ({
  searchActiveTab: SEARCH_TABS.SESSIONS,
  searchFilters: getDefaultSearchFilters(),

  setSearchActiveTab: (tab) => set({ searchActiveTab: tab }),

  setSearchFilters: (tab, filters) => {
    set((state) => ({
      searchFilters: {
        ...state.searchFilters,
        [tab]: {
          ...state.searchFilters[tab],
          ...filters,
        },
      },
    }));
  },

  resetSearchFilters: (tab) => set((state) => ({
    searchFilters: tab
      ? {
          ...state.searchFilters,
          [tab]: getDefaultSearchFilters()[tab],
        }
      : getDefaultSearchFilters(),
  })),

  reset: () => {
    set({
      searchActiveTab: SEARCH_TABS.SESSIONS,
      searchFilters: getDefaultSearchFilters(),
    });
  },
}));

export default useSearchStore;
