import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/stores/useToastStore";
import {
  useCampaignQuery,
  useCampaignMembersQuery,
  useCampaignMutations,
  useCampaignShareLinkQuery,
} from "./useCampaignQueries";
import useAuthStore from "@/stores/useAuthStore";
import usePreviewMode from "@/hooks/usePreviewMode";
import { TABS } from "../components/navigation/CampaignNavigation";
import {
  parseEnumSearchParam,
  parsePositiveIntSearchParam,
  setOrDeleteParam,
  updateSearchParams,
} from "@/utils/urlState";

function buildCampaignShareUrl(token) {
  return `${globalThis.location.origin}/campaign/share/${token}`;
}

function normalizePageError(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (typeof error === "string") return error;

  const responseData = error.response?.data;
  const apiMessage = responseData?.error || responseData?.message;
  if (apiMessage) return apiMessage;

  if (error.response?.status === 403) {
    return 'Недостатньо доступу';
  }

  return error.message || String(error);
}

function resolveCampaignRole({ currentCampaign, user, viewer }) {
  if (!currentCampaign || !user) return null;
  if (viewer.role) return viewer.role;
  if (viewer.isOwner || currentCampaign.ownerId === user.id) return "OWNER";

  const member = currentCampaign.members?.find((entry) => entry.userId === user.id);
  return member?.role || null;
}

function canReadCampaignMembers(currentCampaign, viewer) {
  if (!currentCampaign) return false;
  if (currentCampaign.visibility === "PUBLIC") return true;
  return Boolean(viewer.isOwner || viewer.isMember || viewer.canManage);
}

function resolvePendingRequestStatus({ amMember, currentCampaign, user, viewer }) {
  if (amMember || !currentCampaign || !user) {
    return null;
  }

  return viewer.pendingJoinRequestStatus || null;
}

function canJoinCampaign({ currentCampaign, user, amMember, pendingRequestStatus, viewer }) {
  if (!currentCampaign || !user) return false;
  if (amMember || pendingRequestStatus) return false;
  if (currentCampaign.status === "FINISHED") return false;
  return viewer.joinMode === "REQUEST";
}

const TAB_VALUES = Object.values(TABS);

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

export default function useCampaignPageController() {
  const { id, shareToken: routeShareToken } = useParams();
  const campaignIdNumber = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [lastGeneratedShareLink, setLastGeneratedShareLink] = useState("");

  const hasShareToken = typeof routeShareToken === "string" && routeShareToken.trim().length > 0;
  const isValidId = Number.isInteger(campaignIdNumber) && campaignIdNumber > 0;
  const invalidIdError = !hasShareToken && !isValidId ? 'Кампанія не знайдена' : null;

  const {
    data: currentCampaign,
    isLoading: isCampaignLoading,
    error: campaignError,
  } = useCampaignQuery({
    campaignId: hasShareToken ? null : campaignIdNumber,
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const viewer = useMemo(() => currentCampaign?.viewer || {}, [currentCampaign]);
  const myRole = useMemo(
    () => resolveCampaignRole({ currentCampaign, user, viewer }),
    [currentCampaign, user, viewer]
  );

  const isOwner = Boolean(viewer.isOwner || (currentCampaign && user && currentCampaign.ownerId === user.id));
  const isGM = myRole === "GM";
  const amMember = Boolean(viewer.isOwner || viewer.isMember || isOwner);
  const isCampaignFinished = currentCampaign?.status === "FINISHED";
  const canReadMembers = useMemo(
    () => canReadCampaignMembers(currentCampaign, viewer),
    [currentCampaign, viewer]
  );

  const { data: queriedMembers = [], isLoading: isMembersLoading } = useCampaignMembersQuery(
    currentCampaign?.id ?? null,
    canReadMembers && !hasShareToken
  );

  const campaignMembers = useMemo(() => {
    if (queriedMembers.length > 0) return queriedMembers;
    return currentCampaign?.members || [];
  }, [queriedMembers, currentCampaign]);

  const isLoading = isCampaignLoading || (canReadMembers && !hasShareToken && isMembersLoading);
  const error = normalizePageError(campaignError, invalidIdError);
  const activeCampaignId = currentCampaign?.id ?? (isValidId ? campaignIdNumber : null);
  const mutations = useCampaignMutations(activeCampaignId, {
    shareToken: hasShareToken ? routeShareToken : null,
  });

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
        next.delete("viewing");
        setOrDeleteParam(next, "tab", tab, TABS.SESSIONS);
      });
    },
    [setSearchParams]
  );

  const canManageCampaignSettings = Boolean(viewer.canManage);
  const canManageCampaignVisibility = canManageCampaignSettings;
  const canAssignCampaignRoles = isOwner && !isCampaignFinished;
  const canModerateJoinRequests = (isOwner || isGM) && !isCampaignFinished;
  const canRemovePlayers = (isOwner || isGM) && !isCampaignFinished;
  const canCreateCampaignSessions = (isOwner || isGM) && !isCampaignFinished;
  const canManageShareLink =
    isOwner && currentCampaign?.visibility === "LINK_ONLY" && !isCampaignFinished;
  const canUseOwnerSessionOverrides = isOwner;
  const { isPreviewMode } = usePreviewMode({ isMember: amMember, isLoading });
  const { data: shareLinkData } = useCampaignShareLinkQuery(
    activeCampaignId,
    canManageShareLink && !hasShareToken
  );

  const pendingRequestStatus = useMemo(
    () => resolvePendingRequestStatus({ amMember, currentCampaign, user, viewer }),
    [amMember, currentCampaign, user, viewer]
  );
  const canJoin = useMemo(
    () => canJoinCampaign({ currentCampaign, user, amMember, pendingRequestStatus, viewer }),
    [currentCampaign, user, amMember, pendingRequestStatus, viewer]
  );

  useEffect(() => {
    if (activeTab === TABS.SETTINGS && !canManageCampaignSettings) {
      setActiveTab(TABS.SESSIONS);
    }
  }, [activeTab, canManageCampaignSettings, setActiveTab]);

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

  const handleLeave = useCallback(async () => {
    if (isCampaignFinished) {
      return { success: false, message: 'Не можна покинути завершену кампанію' };
    }

    const myMember = campaignMembers.find((member) => member.userId === user?.id);
    if (!myMember) {
      return { success: false, message: 'Учасника кампанії не знайдено' };
    }

    await mutations.removeMember(myMember.userId);
    navigate("/");
    return { success: true };
  }, [campaignMembers, user, isCampaignFinished, mutations, navigate]);

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

  const handleRefreshCampaign = useCallback(async () => {}, []);

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
    campaignMembers,
    isLoading,
    error,
    activeTab,
    setActiveTab,
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
    canUseOwnerSessionOverrides,
    isCampaignFinished,
    amMember,
    canJoin,
    pendingRequestStatus,
    currentShareLink,
    handleJoinRequest,
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
