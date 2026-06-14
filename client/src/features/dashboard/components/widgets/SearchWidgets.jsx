import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import useSearchStore, { SEARCH_TABS } from "@/stores/useSearchStore";
import {
  useSearchCampaignsQuery,
  useSearchSessionsQuery,
} from "@/features/search/hooks/useSearchQueries";
import SearchFiltersForm from "@/features/search/components/SearchFiltersForm";
import { joinSession } from "@/features/sessions/api/sessionApi";
import DashboardCard from "@/components/ui/DashboardCard";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/shared/EmptyState";
import { VisibilityBadge, SkeletonSessionCard, SkeletonCampaignCard } from "@/components/shared";
import { invalidateSessionCollectionQueries } from "@/lib/queryInvalidation";
import SessionCard from "../ui/SessionCard";
import Dice20 from "@/components/ui/icons/Dice20";
import GroupPeople from "@/components/ui/icons/GroupPeople";
import Data from "@/components/ui/icons/Data";
import { toast } from "@/stores/useToastStore";
import { invalidateSessionPage, sessionQueryKeys } from "@/features/sessions/hooks/useSessionQueries";
import { campaignPageQueryKeys } from "@/features/campaigns/hooks/useCampaignQueries";

const TAB_LABELS = {
  [SEARCH_TABS.SESSIONS]: "Сесії",
  [SEARCH_TABS.CAMPAIGNS]: "Кампанії",
};

function hasActiveFilters(searchActiveTab, filters) {
  if (!filters) return false;

  const sharedHasFilters = Boolean(
    filters.q || filters.system || filters.ownerUsername || filters.onlyMyParticipation
  );
  if (sharedHasFilters) return true;

  if (searchActiveTab === SEARCH_TABS.CAMPAIGNS) {
    return false;
  }

  return Boolean(
    filters.dateFrom
    || filters.dateTo
    || filters.minPrice !== null
    || filters.maxPrice !== null
    || filters.hasAvailableSlots
    || filters.oneShot
  );
}

function flattenSearchItems(searchActiveTab, campaignsData, sessionsData) {
  if (searchActiveTab === SEARCH_TABS.CAMPAIGNS) {
    return campaignsData?.pages?.flatMap((page) => page?.campaigns || []) || [];
  }

  return sessionsData?.pages?.flatMap((page) => page?.sessions || []) || [];
}

function getSearchTotal(searchActiveTab, campaignsData, sessionsData) {
  return searchActiveTab === SEARCH_TABS.CAMPAIGNS
    ? campaignsData?.pages?.[0]?.total || 0
    : sessionsData?.pages?.[0]?.total || 0;
}

function getJoinErrorMessage(error) {
  return error?.response?.data?.error || error?.message || "Помилка при приєднанні";
}


function CampaignSearchResultCard({ campaign, onOpen }) {
  return (
    <button
      onClick={() => onOpen(campaign.id)}
      className="w-full text-left p-4 border-2 border-brand-light/30 rounded-xl hover:border-brand-dark/30 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h4 className="font-bold text-brand-dark truncate">{campaign.title}</h4>
        </div>
        <VisibilityBadge visibility={campaign.visibility} entityType="campaign" compact />
      </div>

      {campaign.description && (
        <p className="text-sm text-brand-medium mb-2 line-clamp-2">{campaign.description}</p>
      )}

      <div className="flex flex-wrap gap-3 text-sm text-brand-medium">
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
        <span className="text-brand-medium">Власник: </span>
        <span className="font-medium text-brand-dark">
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
  hasFiltersApplied,
}) {
  if (isSearchLoading && items.length === 0) {
    const SkeletonCard = searchActiveTab === SEARCH_TABS.CAMPAIGNS
      ? SkeletonCampaignCard
      : SkeletonSessionCard;
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (hasError) {
    return (
      <EmptyState
        title="Не вдалося завантажити результати"
        description="Спробуйте змінити фільтри або оновити сторінку"
      />
    );
  }

  if (items.length === 0) {
    const isCampaignsTab = searchActiveTab === SEARCH_TABS.CAMPAIGNS;
    const emptyEntity = isCampaignsTab ? "кампаній" : "сесій";
    const emptyTitle = hasFiltersApplied ? "Нічого не знайдено" : `Немає доступних ${emptyEntity}`;
    const emptyDescription = hasFiltersApplied
      ? "Спробуйте змінити параметри пошуку"
      : `Коли з'являться ${emptyEntity}, вони будуть тут`;

    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {searchActiveTab === SEARCH_TABS.SESSIONS &&
        items.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isExpanded={expandedSessionId === session.id}
            onToggle={() => handleToggleSession(session.id)}
            onJoin={handleJoinSession}
            isJoining={joiningSessionId === session.id}
            joinError={joinErrors[session.id] || null}
            showDate={true}
          />
        ))}

      {searchActiveTab === SEARCH_TABS.CAMPAIGNS &&
        items.map((campaign) => (
          <CampaignSearchResultCard
            key={campaign.id}
            campaign={campaign}
            onOpen={openCampaign}
          />
        ))}

      {hasMore && (
        <Button
          onClick={loadMoreSearchResults}
          isLoading={isFetchingMore}
          loadingText="Завантаження..."
          variant="outline"
          fullWidth
          className="w-full border-dashed border-brand-light/50 text-brand-medium hover:border-brand-dark hover:text-brand-dark shadow-none hover:shadow-none"
        >
          Завантажити ще
        </Button>
      )}
    </div>
  );
}

SearchResultsBody.propTypes = {
  searchActiveTab: PropTypes.oneOf(Object.values(SEARCH_TABS)).isRequired,
  items: PropTypes.array.isRequired,
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
  hasFiltersApplied: PropTypes.bool.isRequired,
};

export function SearchFiltersWidget({ onSearch }) {
  return <SearchFiltersForm onSearch={onSearch} />;
}

SearchFiltersWidget.propTypes = {
  onSearch: PropTypes.func,
};

export function SearchResultsWidget() {
  const navigate = useNavigate();
  const { searchActiveTab, searchFilters } = useSearchStore();
  const activeFilters = useMemo(
    () => searchFilters[searchActiveTab] || {},
    [searchFilters, searchActiveTab]
  );
  const filtersApplied = useMemo(
    () => hasActiveFilters(searchActiveTab, activeFilters),
    [activeFilters, searchActiveTab]
  );

  const queryClient = useQueryClient();
  const joinMutation = useMutation({
    mutationFn: (id) => joinSession(id, {}),
    onSuccess: async (_result, sessionId) => {
      await Promise.allSettled([
        invalidateSessionCollectionQueries(queryClient),
        invalidateSessionPage(queryClient, { sessionId }),
        queryClient.invalidateQueries({ queryKey: sessionQueryKeys.detail(sessionId) }),
        queryClient.invalidateQueries({ queryKey: campaignPageQueryKeys.all }),
      ]);
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
  } = useSearchCampaignsQuery(searchFilters[SEARCH_TABS.CAMPAIGNS], {
    enabled: searchActiveTab === SEARCH_TABS.CAMPAIGNS,
  });

  const {
    data: sessionsData,
    fetchNextPage: fetchNextSessions,
    hasNextPage: hasNextSessions,
    isFetching: isFetchingSessions,
    isLoading: isSessLoading,
    isError: isSessError,
  } = useSearchSessionsQuery(searchFilters[SEARCH_TABS.SESSIONS], {
    enabled: searchActiveTab === SEARCH_TABS.SESSIONS,
  });

  const isCampaignsTab = searchActiveTab === SEARCH_TABS.CAMPAIGNS;
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
        toast.success("Ви успішно приєдналися. Вашу заявку обробляють.");
      } else {
        setJoinErrors((prev) => ({ ...prev, [sessionId]: result?.error || null }));
        toast.error(result?.error || "Не вдалося приєднатися до сесії");
      }
    } catch (error) {
      const message = getJoinErrorMessage(error);
      setJoinErrors((prev) => ({ ...prev, [sessionId]: message }));
      toast.error(message || "Сталася помилка");
    } finally {
      setJoiningSessionId(null);
    }
  };

  return (
    <DashboardCard title={`${TAB_LABELS[searchActiveTab]} (${total})`}>
      <SearchResultsBody
        searchActiveTab={searchActiveTab}
        items={items}
        hasError={hasError}
        isSearchLoading={isSearchLoading}
        expandedSessionId={expandedSessionId}
        joiningSessionId={joiningSessionId}
        joinErrors={joinErrors}
        handleToggleSession={handleToggleSession}
        handleJoinSession={handleJoinSession}
        openCampaign={(campaignId) => navigate(`/campaign/${campaignId}`)}
        hasMore={Boolean(hasMore)}
        isFetchingMore={isFetchingMore}
        loadMoreSearchResults={loadMoreSearchResults}
        hasFiltersApplied={filtersApplied}
      />
    </DashboardCard>
  );
}

export default { SearchFiltersWidget, SearchResultsWidget };
