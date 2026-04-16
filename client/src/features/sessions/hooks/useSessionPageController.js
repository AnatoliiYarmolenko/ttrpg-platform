import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/stores/useToastStore';
import { useSessionPageQuery, useSessionMutations, useSessionShareLinkQuery } from './useSessionQueries';
import useAuthStore from '@/stores/useAuthStore';
import {
  SESSION_TABS,
  SESSION_TAB_VALUES,
  COMMUNICATION_MODES,
  COMMUNICATION_MODE_VALUES,
} from '../constants/sessionTabs';
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

function normalizeSessionUrlState({
  searchParams,
  activeTab,
  viewingUserId,
  communicationPanelMode,
  setSearchParams,
}) {
  const rawTab = searchParams.get('tab');
  const rawViewing = searchParams.get('viewing');
  const rawComm = searchParams.get('comm');
  const hasInvalidTab = rawTab && rawTab !== activeTab;
  const hasInvalidViewing = rawViewing && !viewingUserId;
  const hasInvalidComm = rawComm && rawComm !== communicationPanelMode;

  if (!hasInvalidTab && !hasInvalidViewing && !hasInvalidComm) {
    return;
  }

  updateSearchParams(setSearchParams, (next) => {
    setOrDeleteParam(next, 'tab', activeTab, SESSION_TABS.DETAILS);
    setOrDeleteParam(next, 'comm', communicationPanelMode, COMMUNICATION_MODES.CHAT);
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

function shouldRedirectSharedGuestToLogin({ hasShareToken, user, queryError }) {
  return Boolean(
    hasShareToken
    && !user
    && (queryError?.response?.status === 401 || queryError?.response?.status === 403)
  );
}

function normalizeServerAvailableTabs(rawTabs) {
  if (!Array.isArray(rawTabs) || rawTabs.length === 0) {
    return [SESSION_TABS.DETAILS, SESSION_TABS.COMMUNICATION];
  }

  const normalizedTabs = rawTabs
    .filter((tab, index, source) => SESSION_TAB_VALUES.includes(tab) && source.indexOf(tab) === index);
  return normalizedTabs.length > 0
    ? normalizedTabs
    : [SESSION_TABS.DETAILS, SESSION_TABS.COMMUNICATION];
}

export default function useSessionPageController() {
  const { id, shareToken: routeShareToken } = useParams();
  const sessionIdNumber = Number(id);
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const [lastGeneratedShareLink, setLastGeneratedShareLink] = useState({
    sessionId: null,
    value: '',
  });

  const hasShareToken = typeof routeShareToken === 'string' && routeShareToken.trim().length > 0;
  const isValidId = Number.isInteger(sessionIdNumber) && sessionIdNumber > 0;
  const invalidIdError = !hasShareToken && !isValidId ? 'Сесія не знайдена' : null;

  const {
    data: pageData,
    isLoading,
    error: queryError,
  } = useSessionPageQuery({
    sessionId: hasShareToken ? null : sessionIdNumber,
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const entity = pageData?.entity || null;
  const viewer = pageData?.viewer || {};
  const actions = pageData?.actions || {};
  const ui = pageData?.ui || {};
  const sections = useMemo(() => pageData?.sections || {}, [pageData]);

  const participantsSection = useMemo(
    () => sections.participants || { visible: false, items: [], count: 0, maxPlayers: null },
    [sections]
  );
  const campaignSection = useMemo(
    () => sections.campaign || { visible: false, linkable: false, data: null },
    [sections]
  );

  const currentSession = useMemo(() => {
    if (!entity) return null;

    return {
      ...entity,
      campaign: campaignSection.data || entity.campaign || null,
      participants: Array.isArray(participantsSection.items) ? participantsSection.items : [],
      participantsSummaryCount: Number.isFinite(Number(participantsSection.count))
        ? Number(participantsSection.count)
        : 0,
    };
  }, [campaignSection.data, entity, participantsSection.count, participantsSection.items]);

  const error = normalizePageError(queryError, invalidIdError);
  const shouldRedirectToLogin = shouldRedirectSharedGuestToLogin({ hasShareToken, user, queryError });

  const activeSessionId = currentSession?.id ?? (isValidId ? sessionIdNumber : null);
  const mutations = useSessionMutations(activeSessionId, {
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const canStartSession = Boolean(actions.canStart);
  const canFinishSession = Boolean(actions.canFinish);
  const canCancelSession = Boolean(actions.canCancel);
  const canDeleteSession = Boolean(actions.canDelete);
  const canManageShareLink = Boolean(actions.canManageShareLink);
  const canManageParticipants = Boolean(actions.canManageParticipants);
  const canManageGmRequests = Boolean(actions.canManageGmRequests);
  const canManageSettings = Boolean(actions.canEditSettings);
  const canManageStatus = Boolean(canStartSession || canFinishSession || canCancelSession);
  const canManageSession = Boolean(canManageStatus || canDeleteSession || canManageShareLink);
  const canReadParticipants = Boolean(participantsSection.visible);
  const canJoin = Boolean(actions.canJoin);
  const canApplyAsGm = Boolean(actions.canApplyAsGm);
  const showCampaignInfo = Boolean(campaignSection.visible);
  const canNavigateToCampaignDirectly = Boolean(campaignSection.linkable);

  const availableTabs = useMemo(() => normalizeServerAvailableTabs(ui.availableTabs), [ui.availableTabs]);

  const activeTab = parseEnumSearchParam(
    searchParams,
    'tab',
    SESSION_TAB_VALUES,
    SESSION_TABS.DETAILS
  );
  const viewingUserId = parsePositiveIntSearchParam(searchParams, 'viewing');
  const communicationPanelMode = parseEnumSearchParam(
    searchParams,
    'comm',
    COMMUNICATION_MODE_VALUES,
    COMMUNICATION_MODES.CHAT
  );

  useEffect(() => {
    normalizeSessionUrlState({
      searchParams,
      activeTab,
      viewingUserId,
      communicationPanelMode,
      setSearchParams,
    });
  }, [communicationPanelMode, activeTab, searchParams, setSearchParams, viewingUserId]);

  const setActiveTab = useCallback((tab) => {
    updateSearchParams(setSearchParams, (next) => {
      const requestedTab = SESSION_TAB_VALUES.includes(tab) ? tab : SESSION_TABS.DETAILS;
      const targetTab = availableTabs.includes(requestedTab) ? requestedTab : SESSION_TABS.DETAILS;
      const shouldKeepViewing = targetTab === SESSION_TABS.COMMUNICATION;

      if (!shouldKeepViewing) {
        next.delete('viewing');
      }

      setOrDeleteParam(next, 'tab', targetTab, SESSION_TABS.DETAILS);

      if (targetTab !== SESSION_TABS.COMMUNICATION) {
        setOrDeleteParam(next, 'comm', COMMUNICATION_MODES.CHAT, COMMUNICATION_MODES.CHAT);
      }
    });
  }, [availableTabs, setSearchParams]);

  const setCommunicationPanelMode = useCallback((mode) => {
    updateSearchParams(setSearchParams, (next) => {
      const targetMode = COMMUNICATION_MODE_VALUES.includes(mode) ? mode : COMMUNICATION_MODES.CHAT;
      setOrDeleteParam(next, 'comm', targetMode, COMMUNICATION_MODES.CHAT);
    });
  }, [setSearchParams]);

  useEffect(() => {
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(SESSION_TABS.DETAILS);
    }
  }, [availableTabs, activeTab, setActiveTab]);

  const isPreviewMode = Boolean(ui.previewMode);

  const myRole = viewer.role || (viewer.isSessionOwner ? 'OWNER' : null);
  const isOwner = Boolean(viewer.isSessionOwner);

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
        message: 'Налаштування недоступні для поточного режиму перегляду',
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
  }, [activeSessionId, canManageSettings, mutations]);

  const handleMarkAsFinished = useCallback(() => mutations.finishSession(), [mutations]);

  const handleDelete = useCallback(async () => {
    const result = await mutations.deleteSession();
    return navigateOnSuccess(result, navigate);
  }, [mutations, navigate]);

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

  const handleViewProfile = useCallback((targetUserId) => {
    updateSearchParams(setSearchParams, (next) => {
      next.set('viewing', targetUserId);
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
    availableTabs,
    setActiveTab,
    communicationPanelMode,
    setCommunicationPanelMode,
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
    canManageSession,
    participantsSection,
    canJoin,
    canApplyAsGm,
    showCampaignInfo,
    canNavigateToCampaignDirectly,
    currentShareLink,
    handleJoin,
    handleLeave,
    handleStatusChange,
    handleMarkAsFinished,
    handleSaveSettings,
    handleDelete,
    handleRegenerateShareLink,
    handleCopyShareLink,
    handleViewProfile,
    handleBackFromProfile,
    navigate,
  };
}
