import React, { useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import useSearchStore from "@/stores/useSearchStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useSearchCampaignsQuery,
  useSearchSessionsQuery,
} from "@/features/search/hooks/useSearchQueries";
import { joinSession } from "@/features/sessions/api/sessionApi";
import DashboardCard from "@/components/ui/DashboardCard";
import SessionCard from "../ui/SessionCard";
import { VisibilityBadge } from "@/components/shared";
import Dice20 from "@/components/ui/icons/Dice20";
import GroupPeople from "@/components/ui/icons/GroupPeople";
import Data from "@/components/ui/icons/Data";
import { GAME_SYSTEMS } from "@/constants/gameSystems";
import { toast } from "@/stores/useToastStore";

function mapSearchFiltersToLocal(searchFilters) {
  return {
    q: searchFilters.q || "",
    system: searchFilters.system || "",
    dateFrom: searchFilters.dateFrom || "",
    dateTo: searchFilters.dateTo || "",
    minPrice: searchFilters.minPrice ?? "",
    maxPrice: searchFilters.maxPrice ?? "",
    hasAvailableSlots: searchFilters.hasAvailableSlots || false,
    oneShot: searchFilters.oneShot || false,
    sortBy: searchFilters.sortBy || "",
  };
}

function flattenSearchItems(searchActiveTab, campaignsData, sessionsData) {
  if (searchActiveTab === "campaigns") {
    return campaignsData?.pages?.flatMap((page) => page?.campaigns || []) || [];
  }

  return sessionsData?.pages?.flatMap((page) => page?.sessions || []) || [];
}

function getSearchTotal(searchActiveTab, campaignsData, sessionsData) {
  return searchActiveTab === "campaigns"
    ? campaignsData?.pages?.[0]?.total || 0
    : sessionsData?.pages?.[0]?.total || 0;
}

function getJoinErrorMessage(error) {
  return error?.response?.data?.error || error?.message || 'Помилка при приєднанні';
}

function CampaignSearchResultCard({ campaign, onOpen }) {
  return (
    <button
      onClick={() => onOpen(campaign.id)}
      className="w-full text-left p-4 border-2 border-[#9DC88D]/30 rounded-xl hover:border-[#164A41]/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h4 className="font-bold text-[#164A41] truncate">{campaign.title}</h4>
        </div>
        <VisibilityBadge visibility={campaign.visibility} iconOnly />
      </div>

      {campaign.description && (
        <p className="text-sm text-[#4D774E] mb-2 line-clamp-2">{campaign.description}</p>
      )}

      <div className="flex flex-wrap gap-3 text-sm text-[#4D774E]">
        {campaign.system && (
          <span className="flex items-center gap-1">
            <Dice20 className="w-4 h-4" /> {campaign.system}
          </span>
        )}
        <span className="flex items-center gap-1">
          <GroupPeople className="w-4 h-4" /> {campaign.membersCount || campaign.members?.length || 0} учасників
        </span>
        <span className="flex items-center gap-1">
          <Data className="w-4 h-4" /> {campaign.sessionsCount || campaign.sessions?.length || 0} сесій
        </span>
      </div>

      <div className="mt-2 text-sm">
        <span className="text-[#4D774E]">Власник: </span>
        <span className="font-medium text-[#164A41]">
          {campaign.owner?.displayName || campaign.owner?.username}
        </span>
      </div>
    </button>
  );
}

CampaignSearchResultCard.propTypes = {
  campaign: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    title: PropTypes.string,
    description: PropTypes.string,
    visibility: PropTypes.string,
    system: PropTypes.string,
    membersCount: PropTypes.number,
    sessionsCount: PropTypes.number,
    members: PropTypes.array,
    sessions: PropTypes.array,
    owner: PropTypes.shape({
      displayName: PropTypes.string,
      username: PropTypes.string,
    }),
  }).isRequired,
  onOpen: PropTypes.func.isRequired,
};

function SearchResultsBody({
  searchActiveTab,
  items,
  hasSearched,
  hasError,
  isSearchLoading,
  expandedSessionId,
  joiningSessionId,
  joinErrors,
  handleToggleSession,
  handleJoinSession,
  openCampaign,
  hasMore,
  isFetchingMore,
  loadMoreSearchResults,
}) {
  if (isSearchLoading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-[#164A41]">Шукаємо...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <p>Помилка пошуку</p>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#4D774E]">
        <p>Введіть параметри пошуку</p>
        <p className="text-sm mt-2">та натисніть "Шукати"</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[#4D774E]">
        <p>Нічого не знайдено</p>
        <p className="text-sm mt-2">Спробуйте змінити фільтри</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {searchActiveTab === "sessions" &&
        items.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isExpanded={expandedSessionId === session.id}
            onToggle={() => handleToggleSession(session.id)}
            onJoin={handleJoinSession}
            isJoining={joiningSessionId === session.id}
            joinError={joinErrors[session.id] || null}
          />
        ))}

      {searchActiveTab === "campaigns" &&
        items.map((campaign) => (
          <CampaignSearchResultCard
            key={campaign.id}
            campaign={campaign}
            onOpen={openCampaign}
          />
        ))}

      {hasMore && (
        <button
          onClick={loadMoreSearchResults}
          disabled={isFetchingMore}
          className="py-3 border-2 border-dashed border-[#9DC88D]/50 rounded-xl text-[#4D774E] hover:border-[#164A41] hover:text-[#164A41] transition-colors disabled:opacity-50"
        >
          {isFetchingMore ? 'Завантаження...' : 'Завантажити ще'}
        </button>
      )}
    </div>
  );
}

SearchResultsBody.propTypes = {
  searchActiveTab: PropTypes.string.isRequired,
  items: PropTypes.array.isRequired,
  hasSearched: PropTypes.bool.isRequired,
  hasError: PropTypes.bool.isRequired,
  isSearchLoading: PropTypes.bool.isRequired,
  expandedSessionId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  joiningSessionId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  joinErrors: PropTypes.object.isRequired,
  handleToggleSession: PropTypes.func.isRequired,
  handleJoinSession: PropTypes.func.isRequired,
  openCampaign: PropTypes.func.isRequired,
  hasMore: PropTypes.bool.isRequired,
  isFetchingMore: PropTypes.bool.isRequired,
  loadMoreSearchResults: PropTypes.func.isRequired,
};

export function SearchFiltersWidget({ onSearch }) {
  const {
    searchFilters,
    setSearchFilters,
    resetSearchFilters,
    searchActiveTab,
    setSearchActiveTab,
    executeSearch,
  } = useSearchStore();

  const [localFilters, setLocalFilters] = useState(() => mapSearchFiltersToLocal(searchFilters));

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLocalFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSearch = async () => {
    setSearchFilters({
      ...localFilters,
      minPrice: localFilters.minPrice ? Number(localFilters.minPrice) : null,
      maxPrice: localFilters.maxPrice ? Number(localFilters.maxPrice) : null,
    });

    executeSearch();

    if (onSearch) {
      onSearch(localFilters);
    }
  };

  const handleClear = async () => {
    resetSearchFilters();
    setLocalFilters(mapSearchFiltersToLocal({}));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const sortOptions =
    searchActiveTab === 'sessions'
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

  return (
    <DashboardCard title="Пошук ігор">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 border-b border-[#9DC88D]/30 pb-3">
          <button
            onClick={() => setSearchActiveTab('sessions')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              searchActiveTab === 'sessions'
                ? 'bg-[#164A41] text-white'
                : 'text-[#4D774E] hover:bg-gray-100'
            }`}
          >
            Сесії
          </button>
          <button
            onClick={() => setSearchActiveTab('campaigns')}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              searchActiveTab === 'campaigns'
                ? 'bg-[#164A41] text-white'
                : 'text-[#4D774E] hover:bg-gray-100'
            }`}
          >
            Кампанії
          </button>
        </div>

        <div>
          <input
            type="text"
            name="q"
            value={localFilters.q}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Пошук за назвою або описом..."
            className="w-full px-4 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label htmlFor="filter-system" className="block text-sm font-medium text-[#164A41] mb-1">
            Система
          </label>
          <select
            id="filter-system"
            name="system"
            value={localFilters.system}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors bg-white"
          >
            <option value="">Всі системи</option>
            {GAME_SYSTEMS.map((sys) => (
              <option key={sys.value} value={sys.value}>
                {sys.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-sortBy" className="block text-sm font-medium text-[#164A41] mb-1">
            Сортування
          </label>
          <select
            id="filter-sortBy"
            name="sortBy"
            value={localFilters.sortBy || (searchActiveTab === 'sessions' ? 'date' : 'newest')}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors bg-white"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {searchActiveTab === 'sessions' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="filter-dateFrom" className="block text-sm font-medium text-[#164A41] mb-1">
                  Від
                </label>
                <input
                  id="filter-dateFrom"
                  type="date"
                  name="dateFrom"
                  value={localFilters.dateFrom}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors text-sm"
                />
              </div>
              <div>
                <label htmlFor="filter-dateTo" className="block text-sm font-medium text-[#164A41] mb-1">
                  До
                </label>
                <input
                  id="filter-dateTo"
                  type="date"
                  name="dateTo"
                  value={localFilters.dateTo}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="filter-minPrice" className="block text-sm font-medium text-[#164A41] mb-1">
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
                  className="w-full px-3 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors text-sm"
                />
              </div>
              <div>
                <label htmlFor="filter-maxPrice" className="block text-sm font-medium text-[#164A41] mb-1">
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
                  className="w-full px-3 py-2 border-2 border-[#9DC88D]/30 rounded-xl focus:border-[#164A41] focus:outline-none transition-colors text-sm"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="hasAvailableSlots"
                  checked={localFilters.hasAvailableSlots}
                  onChange={handleInputChange}
                  className="w-4 h-4 accent-[#164A41]"
                />
                <span className="text-sm text-[#164A41]">Лише з вільними місцями</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="oneShot"
                  checked={localFilters.oneShot}
                  onChange={handleInputChange}
                  className="w-4 h-4 accent-[#164A41]"
                />
                <span className="text-sm text-[#164A41]">Лише one-shot</span>
              </label>
            </div>
          </>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={handleSearch}
            className="flex-1 py-2 bg-[#164A41] text-white rounded-xl hover:bg-[#1f5c52] transition-colors font-medium"
          >
            Шукати
          </button>
          <button
            onClick={handleClear}
            className="px-4 py-2 border-2 border-[#9DC88D]/30 text-[#4D774E] rounded-xl hover:bg-gray-50 transition-colors"
          >
            Очистити
          </button>
        </div>
      </div>
    </DashboardCard>
  );
}

SearchFiltersWidget.propTypes = {
  onSearch: PropTypes.func,
};

export function SearchResultsWidget() {
  const navigate = useNavigate();
  const { searchActiveTab, searchFilters, hasSearched } = useSearchStore();

  const queryClient = useQueryClient();
  const joinMutation = useMutation({
    mutationFn: (id) => joinSession(id, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "games"] });
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
  });

  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [joiningSessionId, setJoiningSessionId] = useState(null);
  const [joinErrors, setJoinErrors] = useState({});

  const {
    data: campaignsData,
    fetchNextPage: fetchNextCampaigns,
    hasNextPage: hasNextCampaigns,
    isFetching: isFetchingCampaigns,
    isLoading: isCampLoading,
    isError: isCampError,
  } = useSearchCampaignsQuery(searchFilters, {
    enabled: hasSearched && searchActiveTab === "campaigns",
  });

  const {
    data: sessionsData,
    fetchNextPage: fetchNextSessions,
    hasNextPage: hasNextSessions,
    isFetching: isFetchingSessions,
    isLoading: isSessLoading,
    isError: isSessError,
  } = useSearchSessionsQuery(searchFilters, {
    enabled: hasSearched && searchActiveTab === "sessions",
  });

  const isCampaignsTab = searchActiveTab === "campaigns";
  const isSearchLoading = isCampaignsTab ? isCampLoading : isSessLoading;
  const isFetchingMore = isCampaignsTab ? isFetchingCampaigns : isFetchingSessions;
  const hasError = isCampaignsTab ? isCampError : isSessError;
  const hasMore = isCampaignsTab ? hasNextCampaigns : hasNextSessions;
  const items = flattenSearchItems(searchActiveTab, campaignsData, sessionsData);
  const total = getSearchTotal(searchActiveTab, campaignsData, sessionsData);

  const loadMoreSearchResults = () => {
    if (isCampaignsTab) {
      fetchNextCampaigns();
      return;
    }

    fetchNextSessions();
  };

  const handleToggleSession = (sessionId) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId));
  };

  const handleJoinSession = async (sessionId) => {
    setJoiningSessionId(sessionId);
    setJoinErrors((prev) => ({ ...prev, [sessionId]: null }));

    try {
      const result = await joinMutation.mutateAsync(sessionId);

      if (result?.success) {
        toast.success('Ви успішно приєдналися. Вашу заявку обробляють.');
      } else {
        setJoinErrors((prev) => ({ ...prev, [sessionId]: result?.error || null }));
        toast.error(result?.error || 'Не вдалося приєднатися до сесії');
      }
    } catch (error) {
      const message = getJoinErrorMessage(error);
      setJoinErrors((prev) => ({ ...prev, [sessionId]: message }));
      toast.error(message || 'Сталася помилка');
    } finally {
      setJoiningSessionId(null);
    }
  };

  return (
    <DashboardCard title={`Результати (${total})`}>
      <SearchResultsBody
        searchActiveTab={searchActiveTab}
        items={items}
        hasSearched={hasSearched}
        hasError={hasError}
        isSearchLoading={isSearchLoading}
        expandedSessionId={expandedSessionId}
        joiningSessionId={joiningSessionId}
        joinErrors={joinErrors}
        handleToggleSession={handleToggleSession}
        handleJoinSession={handleJoinSession}
        openCampaign={(campaignId) => navigate(`/campaign/${campaignId}`)}
        hasMore={hasMore}
        isFetchingMore={isFetchingMore}
        loadMoreSearchResults={loadMoreSearchResults}
      />
    </DashboardCard>
  );
}

export default { SearchFiltersWidget, SearchResultsWidget };
