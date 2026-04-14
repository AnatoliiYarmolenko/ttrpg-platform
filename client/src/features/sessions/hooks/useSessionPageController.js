import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/stores/useToastStore';
import { useSessionQuery, useSessionMutations, useSessionShareLinkQuery } from './useSessionQueries';
import useAuthStore from '@/stores/useAuthStore';
import usePreviewMode from '@/hooks/usePreviewMode';
import { TABS } from '../components/navigation/SessionNavigation';
import {
  parseEnumSearchParam,
  parsePositiveIntSearchParam,
  setOrDeleteParam,
  updateSearchParams,
} from '@/utils/urlState';

function buildSessionShareUrl(token) {
  return `${globalThis.location.origin}/session/share/${token}`;
}

function normalizePageError(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (typeof error === 'string') return error;

  const responseData = error.response?.data;
  const apiMessage = responseData?.error || responseData?.message;
  if (apiMessage) return apiMessage;

  if (error.response?.status === 403) {
    return 'Недостатньо доступу';
  }

  return error.message || String(error);
}

function resolveSessionRole({ currentSession, user, viewer, myParticipant }) {
  if (!currentSession || !user) return null;
  if (viewer.isSessionOwner || currentSession.ownerId === user.id) return 'OWNER';
  if (viewer.role) return viewer.role;
  return myParticipant?.role || null;
}

function canUseSessionJoinFlow({ currentSession, user, hasSessionMembership, isCampaignMember, viewer }) {
  if (!currentSession || !user || hasSessionMembership) {
    return false;
  }

  if (viewer.joinMode === 'MEMBERS_ONLY') {
    return isCampaignMember;
  }

  return viewer.joinMode === 'OPEN' || viewer.joinMode === 'REQUEST';
}

function canJoinSession({ currentSession, user, hasSessionMembership, canUseJoinFlow }) {
  if (!currentSession || !user || hasSessionMembership) return false;
  if (currentSession.status !== 'PLANNED') return false;
  if (currentSession.campaign?.status === 'FINISHED') return false;

  if (currentSession.maxPlayers) {
    const currentPlayers =
      currentSession.participants?.filter((participant) => participant.role === 'PLAYER').length || 0;

    if (currentPlayers >= currentSession.maxPlayers) {
      return false;
    }
  }

  return canUseJoinFlow;
}

function canApplyAsSessionGm({ currentSession, user, hasSessionMembership, canUseJoinFlow }) {
  if (!currentSession || !user || hasSessionMembership) return false;
  if (currentSession.status !== 'PLANNED') return false;
  if (currentSession.campaign?.status === 'FINISHED') return false;
  if (new Date(currentSession.date) < new Date()) return false;

  const hasConfirmedGm = currentSession.participants?.some(
    (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
  );

  if (hasConfirmedGm) {
    return false;
  }

  return canUseJoinFlow;
}

function shouldShowCampaignInfo(currentSession, viewer) {
  if (!currentSession?.campaign) {
    return false;
  }

  const isGuestViewForPublicCampaignSession = currentSession.visibility === 'PUBLIC'
    && currentSession.campaign?.visibility === 'LINK_ONLY'
    && viewer.isCampaignMember === false;

  return !isGuestViewForPublicCampaignSession;
}

const TAB_VALUES = Object.values(TABS);

function normalizeSessionUrlState({ searchParams, activeTab, viewingUserId, setSearchParams }) {
  const rawTab = searchParams.get('tab');
  const rawViewing = searchParams.get('viewing');
  const hasInvalidTab = rawTab && rawTab !== activeTab;
  const hasInvalidViewing = rawViewing && !viewingUserId;

  if (!hasInvalidTab && !hasInvalidViewing) {
    return;
  }

  updateSearchParams(setSearchParams, (next) => {
    setOrDeleteParam(next, 'tab', activeTab, TABS.DETAILS);
    if (hasInvalidViewing) {
      next.delete('viewing');
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
    }

    return false;
  }
}

async function regenerateSessionShareLink({
  canManageShareLink,
  mutations,
  activeSessionId,
  setLastGeneratedShareLink,
}) {
  if (!canManageShareLink) {
    return { success: false, message: 'Лише власник може керувати share-посиланням' };
  }

  const result = await mutations.regenerateShareLink();
  const token = result?.data?.shareToken;

  if (!result?.success || !token) {
    return { success: false, message: result?.error || 'Не вдалося оновити share-посилання' };
  }

  const nextLink = buildSessionShareUrl(token);
  setLastGeneratedShareLink({
    sessionId: activeSessionId,
    value: nextLink,
  });

  await copyText(
    nextLink,
    'Нове share-посилання скопійовано',
    'Нове share-посилання згенеровано'
  );

  return { success: true, link: nextLink };
}

async function copySessionShareLink({
  currentShareLink,
  canManageShareLink,
  refetchShareLink,
  activeSessionId,
  setLastGeneratedShareLink,
}) {
  let shareLinkToCopy = currentShareLink;

  if (!shareLinkToCopy && canManageShareLink) {
    const fetchResult = await refetchShareLink();
    const fetchedShareUrl = fetchResult?.data?.shareUrl || '';

    if (fetchedShareUrl) {
      shareLinkToCopy = fetchedShareUrl;
      setLastGeneratedShareLink({
        sessionId: activeSessionId,
        value: fetchedShareUrl,
      });
    }
  }

  if (!shareLinkToCopy) {
    return { success: false, message: 'Спочатку згенеруйте нове share-посилання' };
  }

  const copied = await copyText(
    shareLinkToCopy,
    'Share-посилання скопійовано'
  );

  return copied
    ? { success: true }
    : { success: false, message: 'Не вдалося скопіювати посилання' };
}

function navigateOnSuccess(result, navigate) {
  if (result?.success) {
    navigate('/');
  }

  return result;
}

function resolveStatusMutation(mutations, newStatus) {
  return newStatus === 'CANCELED'
    ? mutations.cancelSession()
    : mutations.updateStatus(newStatus);
}

function getSettingsUnavailableMessage(isCampaignFinished) {
  return isCampaignFinished
    ? 'Налаштування недоступні: кампанія завершена'
    : 'Налаштування недоступні для сесій у минулому';
}

function shouldRedirectSharedGuestToLogin({ hasShareToken, user, queryError }) {
  return Boolean(
    hasShareToken
    && !user
    && (queryError?.response?.status === 401 || queryError?.response?.status === 403)
  );
}

function deriveSessionRoleState({ viewer, currentSession, user, myParticipant }) {
  const isOwner = Boolean(viewer.isSessionOwner || (currentSession && user && currentSession.ownerId === user.id));
  const amParticipant = Boolean(viewer.isParticipant || myParticipant);
  const isCampaignMember = Boolean(viewer.isCampaignMember);
  const hasSessionMembership = Boolean(isOwner || amParticipant);
  const isEntitledViewer = Boolean(hasSessionMembership || isCampaignMember);
  const isCampaignFinished = currentSession?.campaign?.status === 'FINISHED';
  const isGM = myParticipant?.role === 'GM';
  const isConfirmedGm = isGM && myParticipant?.status === 'CONFIRMED';

  return {
    isOwner,
    amParticipant,
    isCampaignMember,
    hasSessionMembership,
    isEntitledViewer,
    isCampaignFinished,
    isGM,
    isConfirmedGm,
  };
}

function deriveSessionCapabilities({ viewer, currentSession, isOwner, isConfirmedGm, isCampaignFinished }) {
  const canStartSession = isConfirmedGm;
  const canFinishSession = isConfirmedGm;
  const canCancelSession = isOwner || (currentSession?.status === 'ACTIVE' && isConfirmedGm);
  const canDeleteSession = isOwner && currentSession?.status === 'PLANNED';
  const canManageStatus = canStartSession || canFinishSession || canCancelSession;
  const canManageParticipants = Boolean(viewer.canManageParticipants || isConfirmedGm);
  const canManageGmRequests = isOwner;
  const canManageShareLink = isOwner && currentSession?.visibility === 'LINK_ONLY' && !isCampaignFinished;
  const canNavigateToCampaignDirectly = Boolean(
    currentSession?.campaign && currentSession.campaign.visibility !== 'LINK_ONLY'
  );

  return {
    canStartSession,
    canFinishSession,
    canCancelSession,
    canDeleteSession,
    canManageStatus,
    canManageParticipants,
    canManageGmRequests,
    canManageShareLink,
    canNavigateToCampaignDirectly,
  };
}

function isPastSessionDate(sessionDateValue, currentTimestamp) {
  if (!sessionDateValue) return false;

  const sessionDate = new Date(sessionDateValue);
  if (Number.isNaN(sessionDate.getTime())) return false;

  return sessionDate.getTime() < currentTimestamp;
}

function canViewerReadParticipants({ user, currentSession, viewer, isEntitledViewer }) {
  return Boolean(
    user
    && currentSession
    && (viewer.canOpen || currentSession.visibility !== 'LINK_ONLY' || isEntitledViewer)
  );
}

export default function useSessionPageController() {
  const { id, shareToken: routeShareToken } = useParams();
  const sessionIdNumber = Number(id);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [lastGeneratedShareLink, setLastGeneratedShareLink] = useState({
    sessionId: null,
    value: '',
  });

  const hasShareToken = typeof routeShareToken === 'string' && routeShareToken.trim().length > 0;
  const isValidId = Number.isInteger(sessionIdNumber) && sessionIdNumber > 0;
  const invalidIdError = !hasShareToken && !isValidId ? 'Сесія не знайдена' : null;

  const {
    data: currentSession,
    isLoading,
    error: queryError,
  } = useSessionQuery({
    sessionId: hasShareToken ? null : sessionIdNumber,
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const viewer = useMemo(() => currentSession?.viewer || {}, [currentSession]);
  const error = normalizePageError(queryError, invalidIdError);
  const shouldRedirectToLogin = shouldRedirectSharedGuestToLogin({ hasShareToken, user, queryError });

  const activeSessionId = currentSession?.id ?? (isValidId ? sessionIdNumber : null);
  const mutations = useSessionMutations(activeSessionId, {
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const activeTab = parseEnumSearchParam(searchParams, 'tab', TAB_VALUES, TABS.DETAILS);
  const viewingUserId = parsePositiveIntSearchParam(searchParams, 'viewing');

  useEffect(() => {
    normalizeSessionUrlState({
      searchParams,
      activeTab,
      viewingUserId,
      setSearchParams,
    });
  }, [activeTab, searchParams, setSearchParams, viewingUserId]);

  const setActiveTab = useCallback((tab) => {
    updateSearchParams(setSearchParams, (next) => {
      next.delete('viewing');
      setOrDeleteParam(next, 'tab', tab, TABS.DETAILS);
    });
  }, [setSearchParams]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 60_000);

    return () => clearInterval(intervalId);
  }, []);

  const myParticipant = useMemo(() => {
    if (!currentSession || !user) return null;
    return currentSession.participants?.find((participant) => participant.userId === user.id) || null;
  }, [currentSession, user]);

  const myRole = useMemo(
    () => resolveSessionRole({ currentSession, user, viewer, myParticipant }),
    [currentSession, user, viewer, myParticipant]
  );
  const {
    isOwner,
    isCampaignMember,
    hasSessionMembership,
    isEntitledViewer,
    isCampaignFinished,
    isConfirmedGm,
  } = useMemo(
    () => deriveSessionRoleState({ viewer, currentSession, user, myParticipant }),
    [viewer, currentSession, user, myParticipant]
  );
  const {
    canStartSession,
    canFinishSession,
    canCancelSession,
    canDeleteSession,
    canManageStatus,
    canManageParticipants,
    canManageGmRequests,
    canManageShareLink,
    canNavigateToCampaignDirectly,
  } = useMemo(
    () => deriveSessionCapabilities({ viewer, currentSession, isOwner, isConfirmedGm, isCampaignFinished }),
    [viewer, currentSession, isOwner, isConfirmedGm, isCampaignFinished]
  );

  const isSessionInPast = useMemo(() => {
    return isPastSessionDate(currentSession?.date, currentTimestamp);
  }, [currentSession, currentTimestamp]);

  const canManageSettings = Boolean(viewer.canManage) && !isSessionInPast && !isCampaignFinished;
  const canReadParticipants = canViewerReadParticipants({ user, currentSession, viewer, isEntitledViewer });
  const { isPreviewMode } = usePreviewMode({ isMember: hasSessionMembership, isLoading });

  const canUseJoinFlow = useMemo(
    () => canUseSessionJoinFlow({ currentSession, user, hasSessionMembership, isCampaignMember, viewer }),
    [currentSession, user, hasSessionMembership, isCampaignMember, viewer]
  );

  useEffect(() => {
    if (activeTab === TABS.SETTINGS && !canManageSettings) {
      setActiveTab(TABS.DETAILS);
    }
  }, [activeTab, canManageSettings, setActiveTab]);

  const canJoin = useMemo(
    () => canJoinSession({ currentSession, user, hasSessionMembership, canUseJoinFlow }),
    [currentSession, user, hasSessionMembership, canUseJoinFlow]
  );
  const canApplyAsGm = useMemo(
    () => canApplyAsSessionGm({ currentSession, user, hasSessionMembership, canUseJoinFlow }),
    [currentSession, user, hasSessionMembership, canUseJoinFlow]
  );
  const showCampaignInfo = useMemo(
    () => shouldShowCampaignInfo(currentSession, viewer),
    [currentSession, viewer]
  );

  const shouldAutoFetchShareLink = Boolean(canManageShareLink && !hasShareToken);
  const { data: shareLinkData, refetch: refetchShareLink } = useSessionShareLinkQuery(
    activeSessionId,
    shouldAutoFetchShareLink
  );

  const currentShareLink = useMemo(() => {
    if (lastGeneratedShareLink.sessionId === activeSessionId && lastGeneratedShareLink.value) {
      return lastGeneratedShareLink.value;
    }
    if (shareLinkData?.shareUrl) return shareLinkData.shareUrl;
    if (hasShareToken) return buildSessionShareUrl(routeShareToken);
    return '';
  }, [activeSessionId, hasShareToken, routeShareToken, lastGeneratedShareLink, shareLinkData]);

  const handleJoin = useCallback((payload = {}) => mutations.joinSession(payload), [mutations]);
  const handleApplyAsGm = useCallback(() => mutations.joinSession({ role: 'GM' }), [mutations]);

  const handleLeave = useCallback(async () => {
    const result = await mutations.leaveSession();
    return navigateOnSuccess(result, navigate);
  }, [mutations, navigate]);

  const handleStatusChange = useCallback((newStatus) => {
    return resolveStatusMutation(mutations, newStatus);
  }, [mutations]);

  const handleSaveSettings = useCallback(async (sessionData) => {
    if (!canManageSettings) {
      return {
        success: false,
        message: getSettingsUnavailableMessage(isCampaignFinished),
      };
    }

    const result = await mutations.updateSession(sessionData);
    const token = result?.data?.shareToken;
    if (result?.success && token) {
      setLastGeneratedShareLink({
        sessionId: activeSessionId,
        value: buildSessionShareUrl(token),
      });
    }
    return result;
  }, [activeSessionId, canManageSettings, isCampaignFinished, mutations]);

  const handleMarkAsFinished = useCallback(() => mutations.finishSession(), [mutations]);

  const handleDelete = useCallback(async () => {
    const result = await mutations.deleteSession();
    return navigateOnSuccess(result, navigate);
  }, [mutations, navigate]);

  const handleParticipantStatusChange = useCallback((participantId, status) => {
    return mutations.updateParticipantStatus({ participantId, status });
  }, [mutations]);

  const handleRegenerateShareLink = useCallback(async () => {
    return regenerateSessionShareLink({
      canManageShareLink,
      mutations,
      activeSessionId,
      setLastGeneratedShareLink,
    });
  }, [activeSessionId, canManageShareLink, mutations]);

  const handleCopyShareLink = useCallback(async () => {
    return copySessionShareLink({
      currentShareLink,
      canManageShareLink,
      refetchShareLink,
      activeSessionId,
      setLastGeneratedShareLink,
    });
  }, [activeSessionId, canManageShareLink, currentShareLink, refetchShareLink]);

  const handleViewProfile = useCallback((userId) => {
    updateSearchParams(setSearchParams, (next) => {
      next.set('viewing', userId);
    });
  }, [setSearchParams]);

  const handleBackFromProfile = useCallback(() => {
    updateSearchParams(setSearchParams, (next) => {
      next.delete('viewing');
    });
  }, [setSearchParams]);

  return {
    id: activeSessionId,
    routeShareToken,
    user,
    currentSession,
    isLoading,
    error,
    shouldRedirectToLogin,
    activeTab,
    setActiveTab,
    viewingUserId,
    isPreviewMode,
    myRole,
    isOwner,
    canReadParticipants,
    canStartSession,
    canFinishSession,
    canCancelSession,
    canDeleteSession,
    canManageStatus,
    canManageParticipants,
    canManageGmRequests,
    canManageShareLink,
    canManageSettings,
    canJoin,
    canApplyAsGm,
    showCampaignInfo,
    canNavigateToCampaignDirectly,
    currentShareLink,
    handleJoin,
    handleApplyAsGm,
    handleLeave,
    handleStatusChange,
    handleMarkAsFinished,
    handleSaveSettings,
    handleDelete,
    handleParticipantStatusChange,
    handleRegenerateShareLink,
    handleCopyShareLink,
    handleViewProfile,
    handleBackFromProfile,
    navigate,
  };
}
