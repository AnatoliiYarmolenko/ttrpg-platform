import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import useSearchStore, { SEARCH_TABS } from '@/stores/useSearchStore';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import TopBarTabButton from '@/components/ui/TopBarTabButton';
import { GAME_SYSTEMS } from '@/constants/gameSystems';
import {
  getDefaultSortBy,
  mapSearchFiltersToLocal,
  normalizeFiltersForStore,
} from '@/features/search/lib/filterMappers';

const TAB_OPTIONS = [
  { key: SEARCH_TABS.SESSIONS, label: 'Сесії' },
  { key: SEARCH_TABS.CAMPAIGNS, label: 'Кампанії' },
];

function SearchModeSwitch({ activeTab, onChange }) {
  return (
    <fieldset className="max-w-full overflow-x-auto" aria-label="Тип пошуку">
      <legend className="sr-only">Тип пошуку</legend>
      <div className="flex items-center gap-2 min-w-max">
        {TAB_OPTIONS.map((tab) => (
          <TopBarTabButton
            key={tab.key}
            label={tab.label}
            isActive={activeTab === tab.key}
            onClick={() => onChange(tab.key)}
            className="py-2 px-4 text-sm"
          />
        ))}
      </div>
    </fieldset>
  );
}

SearchModeSwitch.propTypes = {
  activeTab: PropTypes.oneOf(Object.values(SEARCH_TABS)).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default function SearchFiltersForm({ onSearch }) {
  const {
    searchFilters,
    setSearchFilters,
    resetSearchFilters,
    searchActiveTab,
    setSearchActiveTab,
  } = useSearchStore();

  const activeFilters = useMemo(
    () => searchFilters[searchActiveTab] || {},
    [searchFilters, searchActiveTab]
  );
  const [localFilters, setLocalFilters] = useState(() =>
    mapSearchFiltersToLocal(activeFilters, searchActiveTab)
  );

  useEffect(() => {
    setLocalFilters(mapSearchFiltersToLocal(activeFilters, searchActiveTab));
  }, [activeFilters, searchActiveTab]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setLocalFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSearch = () => {
    const normalizedFilters = normalizeFiltersForStore(localFilters, searchActiveTab);
    setSearchFilters(searchActiveTab, normalizedFilters);

    if (onSearch) {
      onSearch(normalizedFilters);
    }
  };

  const handleClear = () => {
    resetSearchFilters(searchActiveTab);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };

  const sortOptions =
    searchActiveTab === SEARCH_TABS.SESSIONS
      ? [
          { value: 'date', label: 'За датою' },
          { value: 'newest', label: 'Найновіші' },
          { value: 'price', label: 'За ціною' },
        ]
      : [
          { value: 'newest', label: 'Найновіші' },
          { value: 'popular', label: 'Популярні' },
          { value: 'title', label: 'За назвою' },
        ];

  const systemOptions = [{ value: '', label: 'Всі системи' }, ...GAME_SYSTEMS];
  const ownerLabel = searchActiveTab === SEARCH_TABS.SESSIONS ? 'Організатор' : 'Власник';

  return (
    <DashboardCard
      title="Пошук ігор"
      actions={<SearchModeSwitch activeTab={searchActiveTab} onChange={setSearchActiveTab} />}
    >
      <div className="flex h-full min-h-full flex-col gap-4">
        <div>
          <label htmlFor="filter-q" className="block text-sm font-medium text-brand-dark mb-1">
            Назва або опис
          </label>
          <input
            id="filter-q"
            type="text"
            name="q"
            value={localFilters.q}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Пошук за назвою або описом..."
            className="w-full px-4 py-2 border-2 border-brand-light/30 rounded-xl focus:border-brand-dark transition-colors"
          />
        </div>

        <div>
          <label htmlFor="filter-ownerUsername" className="block text-sm font-medium text-brand-dark mb-1">
            {ownerLabel}
          </label>
          <input
            id="filter-ownerUsername"
            type="text"
            name="ownerUsername"
            value={localFilters.ownerUsername}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Вкажіть ім'я або нікнейм власника"
            className="w-full px-4 py-2 border-2 border-brand-light/30 rounded-xl focus:border-brand-dark transition-colors"
          />
        </div>

        <div>
          <label htmlFor="filter-system" className="block text-sm font-medium text-brand-dark mb-1">
            Система
          </label>
          <Dropdown
            options={systemOptions}
            value={localFilters.system}
            onChange={(option) =>
              setLocalFilters((prev) => ({
                ...prev,
                system: option?.value || '',
              }))
            }
            placeholder="Всі системи"
          />
        </div>

        <div>
          <label htmlFor="filter-sortBy" className="block text-sm font-medium text-brand-dark mb-1">
            Сортування
          </label>
          <Dropdown
            options={sortOptions}
            value={localFilters.sortBy}
            onChange={(option) =>
              setLocalFilters((prev) => ({
                ...prev,
                sortBy: option?.value || getDefaultSortBy(searchActiveTab),
              }))
            }
            placeholder="Оберіть сортування"
          />
        </div>

        {searchActiveTab === SEARCH_TABS.SESSIONS && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="filter-dateFrom" className="block text-sm font-medium text-brand-dark mb-1">
                  Від
                </label>
                <input
                  id="filter-dateFrom"
                  type="date"
                  name="dateFrom"
                  value={localFilters.dateFrom}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border-2 border-brand-light/30 rounded-xl focus:border-brand-dark transition-colors text-sm"
                />
              </div>
              <div>
                <label htmlFor="filter-dateTo" className="block text-sm font-medium text-brand-dark mb-1">
                  До
                </label>
                <input
                  id="filter-dateTo"
                  type="date"
                  name="dateTo"
                  value={localFilters.dateTo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border-2 border-brand-light/30 rounded-xl focus:border-brand-dark transition-colors text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="filter-minPrice" className="block text-sm font-medium text-brand-dark mb-1">
                  Мін. ціна
                </label>
                <input
                  id="filter-minPrice"
                  type="number"
                  name="minPrice"
                  value={localFilters.minPrice}
                  onChange={handleInputChange}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border-2 border-brand-light/30 rounded-xl focus:border-brand-dark transition-colors text-sm"
                />
              </div>
              <div>
                <label htmlFor="filter-maxPrice" className="block text-sm font-medium text-brand-dark mb-1">
                  Макс. ціна
                </label>
                <input
                  id="filter-maxPrice"
                  type="number"
                  name="maxPrice"
                  value={localFilters.maxPrice}
                  onChange={handleInputChange}
                  placeholder="∞"
                  min="0"
                  className="w-full px-3 py-2 border-2 border-brand-light/30 rounded-xl focus:border-brand-dark transition-colors text-sm"
                />
              </div>
            </div>

          </>
        )}

        <div className="flex flex-col gap-2 rounded-xl border-2 border-brand-light/20 bg-brand-light/5 px-3 py-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              id="filter-onlyMyParticipation"
              type="checkbox"
              name="onlyMyParticipation"
              checked={localFilters.onlyMyParticipation}
              onChange={handleInputChange}
              className="w-4 h-4 accent-brand-dark"
            />
            <span className="text-sm text-brand-dark">Лише з моєю участю</span>
          </label>

          {searchActiveTab === SEARCH_TABS.SESSIONS && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasAvailableSlots"
                  checked={localFilters.hasAvailableSlots}
                  onChange={handleInputChange}
                  className="w-4 h-4 accent-brand-dark"
                />
                <span className="text-sm text-brand-dark">Лише з вільними місцями</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="oneShot"
                  checked={localFilters.oneShot}
                  onChange={handleInputChange}
                  className="w-4 h-4 accent-brand-dark"
                />
                <span className="text-sm text-brand-dark">Лише one-shot</span>
              </label>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto pt-2">
          <Button onClick={handleSearch} variant="primary" fullWidth className="w-full py-2 font-medium">
            Застосувати
          </Button>
          <Button
            onClick={handleClear}
            variant="outline"
            fullWidth
            className="w-full py-2 border-brand-dark/40 text-brand-dark"
          >
            Очистити
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}

SearchFiltersForm.propTypes = {
  onSearch: PropTypes.func,
};
