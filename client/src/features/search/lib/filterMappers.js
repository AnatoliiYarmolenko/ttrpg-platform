import { SEARCH_TABS } from '@/stores/useSearchStore';

export function getDefaultSortBy(searchActiveTab) {
  return searchActiveTab === SEARCH_TABS.SESSIONS ? 'date' : 'newest';
}

export function mapSearchFiltersToLocal(searchFilters, searchActiveTab) {
  return {
    q: searchFilters.q || '',
    system: searchFilters.system || '',
    ownerUsername: searchFilters.ownerUsername || '',
    onlyMyParticipation: searchFilters.onlyMyParticipation || false,
    sortBy: searchFilters.sortBy || getDefaultSortBy(searchActiveTab),
    dateFrom: searchFilters.dateFrom || '',
    dateTo: searchFilters.dateTo || '',
    minPrice: searchFilters.minPrice ?? '',
    maxPrice: searchFilters.maxPrice ?? '',
    hasAvailableSlots: searchFilters.hasAvailableSlots || false,
    oneShot: searchFilters.oneShot || false,
  };
}

export function normalizeFiltersForStore(localFilters, searchActiveTab) {
  const sharedFilters = {
    q: localFilters.q.trim(),
    system: localFilters.system || '',
    ownerUsername: localFilters.ownerUsername.trim(),
    onlyMyParticipation: Boolean(localFilters.onlyMyParticipation),
    sortBy: localFilters.sortBy || getDefaultSortBy(searchActiveTab),
  };

  if (searchActiveTab === SEARCH_TABS.CAMPAIGNS) {
    return sharedFilters;
  }

  return {
    ...sharedFilters,
    dateFrom: localFilters.dateFrom || '',
    dateTo: localFilters.dateTo || '',
    minPrice: localFilters.minPrice === '' ? null : Number(localFilters.minPrice),
    maxPrice: localFilters.maxPrice === '' ? null : Number(localFilters.maxPrice),
    hasAvailableSlots: Boolean(localFilters.hasAvailableSlots),
    oneShot: Boolean(localFilters.oneShot),
  };
}
