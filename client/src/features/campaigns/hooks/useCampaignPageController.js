import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from '@/stores/useToastStore';
import {
  useCampaignQuery,
  useCampaignMembersQuery,
  useCampaignMutations,
  useCampaignShareLinkQuery,
} from './useCampaignQueries';
import useAuthStore from '@/stores/useAuthStore';
import usePreviewMode from '@/hooks/usePreviewMode';
import { TABS } from '../components/navigation/CampaignNavigation';

function buildCampaignShareUrl(token) {
  return `${window.location.origin}/campaign/share/${token}`;
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

export default function useCampaignPageController() {
  const { id, shareToken: routeShareToken } = useParams();
  const campaignIdNumber = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const [lastGeneratedShareLink, setLastGeneratedShareLink] = useState('');

  const hasShareToken = typeof routeShareToken === 'string' && routeShareToken.trim().length > 0;
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

  const myRole = useMemo(() => {
    if (!currentCampaign || !user) return null;
    if (viewer.role) return viewer.role;
    if (viewer.isOwner || currentCampaign.ownerId === user.id) return 'OWNER';
    const member = currentCampaign.members?.find((m) => m.userId === user.id);
    return member?.role || null;
  }, [currentCampaign, user, viewer]);

  const isOwner = Boolean(viewer.isOwner || (currentCampaign && user && currentCampaign.ownerId === user.id));
  const isGM = myRole === 'GM';
  const amMember = Boolean(viewer.isOwner || viewer.isMember || isOwner);
  const isCampaignFinished = currentCampaign?.status === 'FINISHED';

  const canReadMembers = useMemo(() => {
    if (!currentCampaign) return false;
    if (currentCampaign.visibility === 'PUBLIC') return true;
    return Boolean(viewer.isOwner || viewer.isMember || viewer.canManage);
  }, [currentCampaign, viewer]);

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

  const activeTab = searchParams.get('tab') || TABS.SESSIONS;
  const viewingUserId = Number(searchParams.get('viewing')) || null;

  const setActiveTab = useCallback(
    (tab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('viewing');
          if (tab === TABS.SESSIONS) {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {}, [activeCampaignId]);

  const canManageCampaignSettings = Boolean(viewer.canManage);
  const canManageCampaignVisibility = canManageCampaignSettings;
  const canAssignCampaignRoles = isOwner && !isCampaignFinished;
  const canModerateJoinRequests = (isOwner || isGM) && !isCampaignFinished;
  const canRemovePlayers = (isOwner || isGM) && !isCampaignFinished;
  const canCreateCampaignSessions = (isOwner || isGM) && !isCampaignFinished;
  const canManageShareLink = isOwner && currentCampaign?.visibility === 'LINK_ONLY' && !isCampaignFinished;
  const canUseOwnerSessionOverrides = isOwner;
  const { isPreviewMode } = usePreviewMode({ isMember: amMember, isLoading });
  const { data: shareLinkData } = useCampaignShareLinkQuery(
    activeCampaignId,
    canManageShareLink && !hasShareToken
  );

  const pendingRequestStatus = useMemo(() => {
    if (amMember || !currentCampaign || !user) return null;
    return viewer.pendingJoinRequestStatus || null;
  }, [amMember, currentCampaign, user, viewer.pendingJoinRequestStatus]);

  const canJoin = useMemo(() => {
    if (!currentCampaign || !user) return false;
    if (amMember || pendingRequestStatus) return false;
    if (currentCampaign.status === 'FINISHED') return false;
    return viewer.joinMode === 'REQUEST';
  }, [currentCampaign, user, amMember, pendingRequestStatus, viewer.joinMode]);

  const currentShareLink = useMemo(() => {
    if (lastGeneratedShareLink) return lastGeneratedShareLink;
    if (shareLinkData?.shareUrl) return shareLinkData.shareUrl;
    if (hasShareToken) return buildCampaignShareUrl(routeShareToken);
    return '';
  }, [hasShareToken, routeShareToken, lastGeneratedShareLink, shareLinkData]);

  const handleJoinRequest = useCallback(async (message) => {
    const result = await mutations.submitJoinRequest(message);
    if (result?.success) return { success: true };
    return { success: false, error: result?.error || 'Помилка при подачі заявки' };
  }, [mutations]);

  const handleLeave = useCallback(async () => {
    if (isCampaignFinished) {
      return { success: false, message: 'Не можна покинути завершену кампанію' };
    }

    const myMember = campaignMembers.find((member) => member.userId === user?.id);
    if (myMember) {
      await mutations.removeMember(myMember.userId);
      navigate('/');
      return { success: true };
    }

    return { success: false, message: 'Учасника кампанії не знайдено' };
  }, [campaignMembers, user, isCampaignFinished, mutations, navigate]);

  const handleRegenerateShareLink = useCallback(async () => {
    if (!canManageShareLink) {
      return { success: false, message: 'Тільки власник може керувати share-посиланням' };
    }

    const result = await mutations.regenerateShareLink();
    const token = result?.data?.shareToken;

    if (!result?.success || !token) {
      return { success: false, message: result?.error || 'Не вдалося оновити share-посилання' };
    }

    const nextLink = buildCampaignShareUrl(token);
    setLastGeneratedShareLink(nextLink);

    try {
      await navigator.clipboard.writeText(nextLink);
      toast.success('Нове share-посилання скопійовано');
    } catch {
      toast.info('Нове share-посилання згенеровано');
    }

    return { success: true, link: nextLink };
  }, [canManageShareLink, mutations]);

  const handleCopyShareLink = useCallback(async () => {
    if (!currentShareLink) {
      return { success: false, message: 'Спочатку згенеруйте нове share-посилання' };
    }

    try {
      await navigator.clipboard.writeText(currentShareLink);
      toast.success('Share-посилання скопійовано');
      return { success: true };
    } catch {
      return { success: false, message: 'Не вдалося скопіювати посилання' };
    }
  }, [currentShareLink]);

  const handleRefreshCampaign = useCallback(async () => {}, []);

  const handleSaveSettings = useCallback(async (campaignData) => {
    if (!canManageCampaignSettings) {
      return { success: false, message: 'Тільки власник може змінювати налаштування кампанії' };
    }

    const result = await mutations.updateCampaign(campaignData);
    const token = result?.data?.shareToken;
    if (result?.success && token) {
      setLastGeneratedShareLink(buildCampaignShareUrl(token));
    }
    return result;
  }, [canManageCampaignSettings, mutations]);

  const handleTransferOwnership = useCallback(async (newOwnerId) => {
    if (!isOwner) {
      return { success: false, message: 'Тільки власник може передавати права кампанії' };
    }
    return mutations.transferOwnership(Number(newOwnerId));
  }, [isOwner, mutations]);

  const handleCancelForeignSession = useCallback((sessionId) => {
    return mutations.cancelSession(Number(sessionId));
  }, [mutations]);

  const handleDeleteForeignSession = useCallback((sessionId) => {
    return mutations.deleteSession(Number(sessionId));
  }, [mutations]);

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
