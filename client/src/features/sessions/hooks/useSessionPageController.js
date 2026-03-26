import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/stores/useToastStore';
import { useSessionQuery, useSessionMutations, useSessionShareLinkQuery } from './useSessionQueries';
import useAuthStore from '@/stores/useAuthStore';
import usePreviewMode from '@/hooks/usePreviewMode';
import { TABS } from '../components/navigation/SessionNavigation';

function buildSessionShareUrl(token) {
  return `${window.location.origin}/session/share/${token}`;
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
  const shouldRedirectToLogin = Boolean(
    hasShareToken
    && !user
    && (queryError?.response?.status === 401 || queryError?.response?.status === 403)
  );

  const activeSessionId = currentSession?.id ?? (isValidId ? sessionIdNumber : null);
  const mutations = useSessionMutations(activeSessionId, {
    shareToken: hasShareToken ? routeShareToken : null,
  });

  const activeTab = searchParams.get('tab') || TABS.DETAILS;
  const viewingUserId = Number(searchParams.get('viewing')) || null;

  const setActiveTab = useCallback((tab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('viewing');
        if (tab === TABS.DETAILS) {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true }
    );
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

  const myRole = useMemo(() => {
    if (!currentSession || !user) return null;
    if (viewer.isSessionOwner || currentSession.ownerId === user.id) return 'OWNER';
    if (viewer.role) return viewer.role;
    return myParticipant?.role || null;
  }, [currentSession, user, viewer, myParticipant]);

  const isOwner = Boolean(viewer.isSessionOwner || (currentSession && user && currentSession.ownerId === user.id));
  const amParticipant = Boolean(viewer.isParticipant || myParticipant);
  const isCampaignMember = Boolean(viewer.isCampaignMember);
  const hasSessionMembership = Boolean(isOwner || amParticipant);
  const isEntitledViewer = Boolean(hasSessionMembership || isCampaignMember);
  const isCampaignFinished = currentSession?.campaign?.status === 'FINISHED';
  const isGM = myParticipant?.role === 'GM';
  const isConfirmedGm = isGM && myParticipant?.status === 'CONFIRMED';

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

  const isSessionInPast = useMemo(() => {
    if (!currentSession?.date) return false;
    const sessionDate = new Date(currentSession.date);
    if (Number.isNaN(sessionDate.getTime())) return false;
    return sessionDate.getTime() < currentTimestamp;
  }, [currentSession, currentTimestamp]);

  const canManageSettings = Boolean(viewer.canManage) && !isSessionInPast && !isCampaignFinished;
  const canReadParticipants = Boolean(
    user
    && currentSession
    && (viewer.canOpen || currentSession.visibility !== 'LINK_ONLY' || isEntitledViewer)
  );
  const { isPreviewMode } = usePreviewMode({ isMember: hasSessionMembership, isLoading });

  const canUseJoinFlow = useMemo(() => {
    if (!currentSession || !user) return false;
    if (hasSessionMembership) return false;

    if (viewer.joinMode === 'MEMBERS_ONLY') {
      return isCampaignMember;
    }

    return viewer.joinMode === 'OPEN' || viewer.joinMode === 'REQUEST';
  }, [currentSession, user, hasSessionMembership, isCampaignMember, viewer.joinMode]);

  useEffect(() => {
    if (activeTab === TABS.SETTINGS && !canManageSettings) {
      setActiveTab(TABS.DETAILS);
    }
  }, [activeTab, canManageSettings, setActiveTab]);

  const canJoin = useMemo(() => {
    if (!currentSession || !user) return false;
    if (hasSessionMembership) return false;
    if (currentSession.status !== 'PLANNED') return false;
    if (currentSession.campaign?.status === 'FINISHED') return false;
    if (currentSession.maxPlayers) {
      const currentPlayers =
        currentSession.participants?.filter((participant) => participant.role === 'PLAYER').length || 0;
      if (currentPlayers >= currentSession.maxPlayers) return false;
    }

    return canUseJoinFlow;
  }, [canUseJoinFlow, currentSession, user, hasSessionMembership]);

  const canApplyAsGm = useMemo(() => {
    if (!currentSession || !user) return false;
    if (hasSessionMembership) return false;
    if (currentSession.status !== 'PLANNED') return false;
    if (currentSession.campaign?.status === 'FINISHED') return false;
    if (new Date(currentSession.date) < new Date()) return false;

    const hasConfirmedGm = currentSession.participants?.some(
      (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
    );

    if (hasConfirmedGm) return false;
    return canUseJoinFlow;
  }, [canUseJoinFlow, currentSession, user, hasSessionMembership]);

  const showCampaignInfo = useMemo(() => {
    if (!currentSession?.campaign) return false;

    const isGuestViewForPublicCampaignSession = currentSession.visibility === 'PUBLIC'
      && currentSession.campaign?.visibility === 'LINK_ONLY'
      && viewer.isCampaignMember === false;

    return !isGuestViewForPublicCampaignSession;
  }, [currentSession, viewer.isCampaignMember]);

  const shouldAutoFetchShareLink = Boolean(
    canManageShareLink
    && !hasShareToken
  );

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
    if (result?.success) {
      navigate('/');
    }
    return result;
  }, [mutations, navigate]);

  const handleStatusChange = useCallback((newStatus) => {
    if (newStatus === 'CANCELED') {
      return mutations.cancelSession();
    }
    return mutations.updateStatus(newStatus);
  }, [mutations]);

  const handleSaveSettings = useCallback(async (sessionData) => {
    if (!canManageSettings) {
      return {
        success: false,
        message: isCampaignFinished
          ? 'Налаштування недоступні: кампанія завершена'
          : 'Налаштування недоступні для сесій у минулому',
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
    if (result?.success) {
      navigate('/');
    }
    return result;
  }, [mutations, navigate]);

  const handleParticipantStatusChange = useCallback((participantId, status) => {
    return mutations.updateParticipantStatus({ participantId, status });
  }, [mutations]);

  const handleRegenerateShareLink = useCallback(async () => {
    if (!canManageShareLink) {
      return { success: false, message: 'Тільки власник може керувати share-посиланням' };
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

    try {
      await navigator.clipboard.writeText(nextLink);
      toast.success('Нове share-посилання скопійовано');
    } catch {
      toast.info('Нове share-посилання згенеровано');
    }

    return { success: true, link: nextLink };
  }, [activeSessionId, canManageShareLink, mutations]);

  const handleCopyShareLink = useCallback(async () => {
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

    try {
      await navigator.clipboard.writeText(shareLinkToCopy);
      toast.success('Share-посилання скопійовано');
      return { success: true };
    } catch {
      return { success: false, message: 'Не вдалося скопіювати посилання' };
    }
  }, [activeSessionId, canManageShareLink, currentShareLink, refetchShareLink]);

  const handleViewProfile = useCallback((userId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('viewing', userId);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const handleBackFromProfile = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('viewing');
        return next;
      },
      { replace: true }
    );
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
