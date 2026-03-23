import { create } from 'zustand';

const getDefaultSearchFilters = () => ({
  q: '',
  system: '',
  dateFrom: '',
  dateTo: '',
  minPrice: null,
  maxPrice: null,
  hasAvailableSlots: false,
  oneShot: false,
  sortBy: '',
  limit: 20,
});

const useSearchStore = create((set) => ({
  searchActiveTab: 'sessions',
  searchFilters: getDefaultSearchFilters(),
  hasSearched: false,

  setSearchActiveTab: (tab) => set({ searchActiveTab: tab }),

  setSearchFilters: (filters) => {
    set((state) => ({
      searchFilters: { ...state.searchFilters, ...filters },
    }));
  },

  setHasSearched: (value) => set({ hasSearched: Boolean(value) }),

  resetSearchFilters: () => {
    set({
      searchFilters: getDefaultSearchFilters(),
      hasSearched: false,
    });
  },

  executeSearch: () => {
    set({ hasSearched: true });
  },

  reset: () => {
    set({
      searchActiveTab: 'sessions',
      searchFilters: getDefaultSearchFilters(),
      hasSearched: false,
    });
  },
}));

export default useSearchStore;