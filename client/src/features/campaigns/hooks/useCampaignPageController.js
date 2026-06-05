import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/stores/useToastStore";
import {
  useCampaignPageQuery,
  useCampaignMutations,
  useCampaignShareLinkQuery,
} from "./useCampaignQueries";
import useAuthStore from "@/stores/useAuthStore";
import { CAMPAIGN_TABS as TABS, CAMPAIGN_TAB_VALUES as TAB_VALUES, CAMPAIGN_COMMUNICATION_MODES } from "../constants/campaignTabs";
import {
  parseEnumSearchParam,
  parsePositiveIntSearchParam,
  setOrDeleteParam,
  updateSearchParams,
} from "@/utils/urlState";
import { normalizePageError } from "@/utils/errorUtils";

function shouldRedirectSharedGuestToLogin({ hasShareToken, user, queryError }) {
  return Boolean(
    hasShareToken
    && !user
    && (queryError?.response?.status === 401 || queryError?.response?.status === 403)
  );
}

function buildCampaignShareUrl(token) {
  return `${globalThis.location.origin}/campaign/share/${token}`;
}


function normalizeCampaignUrlState({ searchParams, activeTab, viewingUserId, setSearchParams }) {
  const rawTab = searchParams.get("tab");
  const rawViewing = searchParams.get("viewing");
  const hasInvalidTab = rawTab && rawTab !== activeTab;
  const hasInvalidViewing = rawViewing && !viewingUserId;

  if (!hasInvalidTab && !hasInvalidViewing) {
    return;
  }

  updateSearchParams(setSearchParams, (next) => {
    setOrDeleteParam(next, "tab", activeTab, TABS.SESSIONS);
    if (hasInvalidViewing) {
      next.delete("viewing");
    }
  }, { replace: true });
}

async function copyText(text, successMessage, fallbackMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
    return true;
  } catch {
    if (fallbackMessage) {
      toast.info(fallbackMessage);
      return false;
    }

    return false;
  }
}

async function regenerateCampaignShareLink({ canManageShareLink, mutations, setLastGeneratedShareLink }) {
  if (!canManageShareLink) {
    return { success: false, message: 'Лише власник може керувати share-посиланням' };
  }

  const result = await mutations.regenerateShareLink();
  const token = result?.data?.shareToken;

  if (!result?.success || !token) {
    return { success: false, message: result?.error || 'Не вдалося оновити share-посилання' };
  }

  const nextLink = buildCampaignShareUrl(token);
  setLastGeneratedShareLink(nextLink);
  await copyText(nextLink, 'Нове share-посилання скопійовано', 'Нове share-посилання згенеровано');

  return { success: true, link: nextLink };
}

async function copyCampaignShareLink(currentShareLink) {
  if (!currentShareLink) {
    return { success: false, message: 'Спочатку згенеруйте нове share-посилання' };
  }

  const copied = await copyText(currentShareLink, 'Share-посилання скопійовано');

  return copied
    ? { success: true }
    : { success: false, message: 'Не вдалося скопіювати посилання' };
}

function normalizeAvailableTabs(rawTabs, { canManageSettings = false } = {}) {
  if (!Array.isArray(rawTabs) || rawTabs.length === 0) {
    return canManageSettings
      ? [TABS.SESSIONS, TABS.DETAILS, TABS.MANAGE]
      : [TABS.SESSIONS, TABS.DETAILS];
  }

  const allowedTabs = Object.values(TABS);
  const normalizedTabs = rawTabs.filter((tab, index, source) =>
    allowedTabs.includes(tab) && source.indexOf(tab) === index
  );

  if (canManageSettings && !normalizedTabs.includes(TABS.MANAGE)) {
    normalizedTabs.push(TABS.MANAGE);
  }

  if (normalizedTabs.length > 0) {
    return normalizedTabs;
  }

  return canManageSettings
    ? [TABS.SESSIONS, TABS.DETAILS, TABS.MANAGE]
    : [TABS.SESSIONS, TABS.DETAILS];
}

export default function useCampaignPageController() {
  const { id, shareToken: routeShareToken } = useParams();
  const campaignIdNumber = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [lastGeneratedShareLink, setLastGeneratedShareLink] = useState("");
  const [campaignCommunicationMode, setCampaignCommunicationMode] = useState(CAMPAIGN_COMMUNICATION_MODES.CHAT);

  const hasShareToken = typeof routeShareToken === "string" && routeShareToken.trim().length > 0;
  const isValidId = Number.isInteger(campaignIdNumber) && campaignIdNumber > 0;
  const invalidIdError = !hasShareToken && !isValidId ? 'Кампанія не знайдена' : null;

  const {
    data: pageData,
    isLoading: isCampaignLoading,
    error: campaignError,
    refetch: refetchCampaignPage,
  } = useCampaignPageQuery({
    campaignId: hasShareToken ? null : campaignIdNumber,
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const entity = pageData?.entity || null;
  const viewer = pageData?.viewer || {};
  const actions = pageData?.actions || {};
  const ui = pageData?.ui || {};
  const sections = useMemo(() => pageData?.sections || {}, [pageData]);

  const membersSection = useMemo(
    () => sections.members || { visible: false, count: 0, items: [] },
    [sections]
  );
  const joinRequestsSection = useMemo(
    () => sections.joinRequests || { visible: false, count: 0, items: [] },
    [sections]
  );
  const sessionsSection = useMemo(
    () => sections.sessions || { visible: true, count: 0, items: [] },
    [sections]
  );

  const currentCampaign = useMemo(() => {
    if (!entity) return null;

    return {
      ...entity,
      members: membersSection.items,
      sessions: sessionsSection.items,
      joinRequests: joinRequestsSection.items,
      membersCount: Number.isFinite(Number(membersSection.count))
        ? Number(membersSection.count)
        : 0,
      sessionsCount: Number.isFinite(Number(sessionsSection.count))
        ? Number(sessionsSection.count)
        : 0,
    };
  }, [entity, joinRequestsSection.items, membersSection.count, membersSection.items, sessionsSection.count, sessionsSection.items]);

  const isLoading = isCampaignLoading;
  const error = normalizePageError(campaignError, invalidIdError);
  const shouldRedirectToLogin = shouldRedirectSharedGuestToLogin({ hasShareToken, user, queryError: campaignError });
  const activeCampaignId = currentCampaign?.id ?? (isValidId ? campaignIdNumber : null);
  const mutations = useCampaignMutations(activeCampaignId, {
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const isUpdatingSettings = mutations.isPendingUpdate;
  const isRegeneratingShareLink = mutations.isPendingRegenerateShareLink;

  const canManageCampaignSettings = Boolean(actions.canEditSettings);
  const availableTabs = useMemo(
    () => normalizeAvailableTabs(ui.availableTabs, { canManageSettings: canManageCampaignSettings }),
    [ui.availableTabs, canManageCampaignSettings]
  );

  const activeTab = parseEnumSearchParam(searchParams, "tab", TAB_VALUES, TABS.SESSIONS);
  const viewingUserId = parsePositiveIntSearchParam(searchParams, "viewing");

  useEffect(() => {
    normalizeCampaignUrlState({
      searchParams,
      activeTab,
      viewingUserId,
      setSearchParams,
    });
  }, [activeTab, searchParams, setSearchParams, viewingUserId]);

  const setActiveTab = useCallback(
    (tab) => {
      updateSearchParams(setSearchParams, (next) => {
        const targetTab = availableTabs.includes(tab) ? tab : TABS.SESSIONS;
        next.delete("viewing");
        setOrDeleteParam(next, "tab", targetTab, TABS.SESSIONS);
      });
    },
    [availableTabs, setSearchParams]
  );

  const canManageCampaignVisibility = canManageCampaignSettings;
  const isOwner = Boolean(viewer.isOwner);
  const myRole = viewer.role || (isOwner ? "OWNER" : null);
  const isGM = myRole === "GM";
  const amMember = Boolean(viewer.isMember || isOwner);
  const isCampaignFinished = currentCampaign?.status === "FINISHED";
  const canReadMembers = Boolean(membersSection.visible);
  const canAssignCampaignRoles = Boolean(isOwner && !isCampaignFinished);
  const canModerateJoinRequests = Boolean(joinRequestsSection.visible);
  const canRemovePlayers = Boolean((isOwner || isGM) && !isCampaignFinished);
  const canCreateCampaignSessions = Boolean(actions.canCreateSessions);
  const canManageShareLink = Boolean(actions.canManageShareLink);
  const canCancelJoinRequest = Boolean(actions.canCancelJoinRequest);
  const isPreviewMode = Boolean(ui.previewMode);

  const { data: shareLinkData } = useCampaignShareLinkQuery(
    activeCampaignId,
    canManageShareLink && !hasShareToken
  );

  const pendingRequestStatus = viewer.pendingJoinRequestStatus || null;
  const canJoin = Boolean(actions.canSubmitJoinRequest);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(TABS.SESSIONS);
    }
  }, [activeTab, availableTabs, setActiveTab]);

  const currentShareLink = useMemo(() => {
    if (lastGeneratedShareLink) return lastGeneratedShareLink;
    if (shareLinkData?.shareUrl) return shareLinkData.shareUrl;
    if (hasShareToken) return buildCampaignShareUrl(routeShareToken);
    return "";
  }, [hasShareToken, routeShareToken, lastGeneratedShareLink, shareLinkData]);

  const handleJoinRequest = useCallback(
    async (message) => {
      const result = await mutations.submitJoinRequest(message);
      if (result?.success) return { success: true };
      return { success: false, error: result?.error || 'Помилка при подачі заявки' };
    },
    [mutations]
  );

  const handleCancelJoinRequest = useCallback(async () => {
    const result = await mutations.cancelJoinRequest();
    if (result?.success) return { success: true };
    return { success: false, error: result?.error || 'Не вдалося відкликати заявку' };
  }, [mutations]);

  const handleLeave = useCallback(async () => {
    if (isCampaignFinished) {
      return { success: false, message: 'Не можна покинути завершену кампанію' };
    }

    const myMember = membersSection.items.find((member) => member.userId === user?.id);
    if (!myMember) {
      return { success: false, message: 'Учасника кампанії не знайдено' };
    }

    try {
      await mutations.removeMember(myMember.userId);
      navigate('/');
      return { success: true };
    } catch {
      return { success: false, message: 'Не вдалося покинути кампанію' };
    }
  }, [membersSection.items, user, isCampaignFinished, mutations, navigate]);

  const handleRegenerateShareLink = useCallback(async () => {
    return regenerateCampaignShareLink({
      canManageShareLink,
      mutations,
      setLastGeneratedShareLink,
    });
  }, [canManageShareLink, mutations]);

  const handleCopyShareLink = useCallback(async () => {
    return copyCampaignShareLink(currentShareLink);
  }, [currentShareLink]);

  const handleRefreshCampaign = useCallback(async () => {
    await refetchCampaignPage();
  }, [refetchCampaignPage]);

  const handleSaveSettings = useCallback(
    async (campaignData) => {
      if (!canManageCampaignSettings) {
        return { success: false, message: 'Лише власник може оновлювати налаштування кампанії' };
      }

      const result = await mutations.updateCampaign(campaignData);
      const token = result?.data?.shareToken;
      if (result?.success && token) {
        setLastGeneratedShareLink(buildCampaignShareUrl(token));
      }
      return result;
    },
    [canManageCampaignSettings, mutations]
  );

  const handleTransferOwnership = useCallback(
    async (newOwnerId) => {
      if (!isOwner) {
        return { success: false, message: 'Лише власник може передати права кампанії' };
      }

      return mutations.transferOwnership(Number(newOwnerId));
    },
    [isOwner, mutations]
  );

  const handleCancelForeignSession = useCallback(
    (sessionId) => mutations.cancelSession(Number(sessionId)),
    [mutations]
  );

  const handleDeleteForeignSession = useCallback(
    (sessionId) => mutations.deleteSession(Number(sessionId)),
    [mutations]
  );

  const handleViewProfile = useCallback(
    (userId) => {
      updateSearchParams(setSearchParams, (next) => {
        next.set("viewing", userId);
      });
    },
    [setSearchParams]
  );

  const handleBackFromProfile = useCallback(
    () => {
      updateSearchParams(setSearchParams, (next) => {
        next.delete("viewing");
      });
    },
    [setSearchParams]
  );

  return {
    id: activeCampaignId,
    routeShareToken,
    user,
    currentCampaign,
    membersSection,
    joinRequestsSection,
    sessionsSection,
    isLoading,
    error,
    shouldRedirectToLogin,
    activeTab,
    availableTabs,
    setActiveTab,
    campaignCommunicationMode,
    setCampaignCommunicationMode,
    viewingUserId,
    isPreviewMode,
    myRole,
    isOwner,
    isGM,
    canReadMembers,
    canManageCampaignSettings,
    canManageCampaignVisibility,
    canAssignCampaignRoles,
    canModerateJoinRequests,
    canRemovePlayers,
    canCreateCampaignSessions,
    canManageShareLink,
    isCampaignFinished,
    amMember,
    canJoin,
    canCancelJoinRequest,
    pendingRequestStatus,
    currentShareLink,
    isUpdatingSettings,
    isRegeneratingShareLink,
    handleJoinRequest,
    handleCancelJoinRequest,
    handleLeave,
    handleRefreshCampaign,
    handleRegenerateShareLink,
    handleCopyShareLink,
    handleSaveSettings,
    handleTransferOwnership,
    handleCancelForeignSession,
    handleDeleteForeignSession,
    handleViewProfile,
    handleBackFromProfile,
    navigate,
  };
}
