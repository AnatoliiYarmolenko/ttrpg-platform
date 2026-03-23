import { useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useCampaignQuery, useCampaignMembersQuery, useCampaignMutations } from './useCampaignQueries';
import useAuthStore from '@/stores/useAuthStore';
import usePreviewMode from '@/hooks/usePreviewMode';
import { TABS } from '../components/navigation/CampaignNavigation';

/**
 * useCampaignPageController — основна логіка CampaignPage.
 *
 * Інкапсулює:
 * - завантаження кампанії та членів
 * - обчислення ролей/прав
 * - логіку preview vs full mode
 * - синхронізацію ?tab із URL
 * - перегляд профілю учасника
 * - усі дії (join, leave, save, delete, тощо)
 *
 * @returns об'єкт із готовими пропсами для layout та віджетів
 */
export default function useCampaignPageController() {
  const { id } = useParams();
  const campaignIdNumber = Number(id);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteCode = searchParams.get('inviteCode') || null;

  const user = useAuthStore((state) => state.user);

  // Validate that id is a proper positive integer
  const isValidId = Number.isInteger(campaignIdNumber) && campaignIdNumber > 0;
  const invalidIdError = !isValidId ? 'Кампанія не знайдена' : null;

  const { data: currentCampaign, isLoading: isCampaignLoading, error: campaignError } = useCampaignQuery(campaignIdNumber, inviteCode);
  const { data: campaignMembers = [], isLoading: isMembersLoading } = useCampaignMembersQuery(campaignIdNumber);
  
  const isLoading = isCampaignLoading || isMembersLoading;
  // Normalize error to string: extract message from Error objects
  const normalizedError = campaignError
    ? typeof campaignError === 'string'
      ? campaignError
      : campaignError.message || String(campaignError)
    : invalidIdError;
  const error = normalizedError;

  const mutations = useCampaignMutations(campaignIdNumber);

  // Таби та перегляд профілю — обидва в URL, щоб перемикання було атомарним (без миготіння)
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
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Скидання viewing при зміні id вже не потребує очищення store
  useEffect(() => {
    // Empty effect for compatibility, no manual loading needed
  }, [campaignIdNumber]);


  // === Ролі та права ===
  const myRole = useMemo(() => {
    if (!currentCampaign || !user) return null;
    if (currentCampaign.ownerId === user.id) return 'OWNER';
    const member = currentCampaign.members?.find((m) => m.userId === user.id);
    return member?.role || null;
  }, [currentCampaign, user]);

  const amMember = useMemo(() => {
    if (!currentCampaign || !user) return false;
    if (currentCampaign.ownerId === user.id) return true;
    return currentCampaign.members?.some((m) => m.userId === user.id);
  }, [currentCampaign, user]);

  const isOwner = myRole === 'OWNER';
  const isGM = myRole === 'GM';
  const isCampaignFinished = currentCampaign?.status === 'FINISHED';
  const canManageCampaignSettings = isOwner;
  const canManageCampaignVisibility = isOwner;
  const canAssignCampaignRoles = isOwner && !isCampaignFinished;
  const canModerateJoinRequests = isOwner || isGM;
  const canRemovePlayers = (isOwner || isGM) && !isCampaignFinished;
  const canCreateCampaignSessions = (isOwner || isGM) && !isCampaignFinished;
  const canManageInviteCode = isOwner && !isCampaignFinished;
  const canUseOwnerSessionOverrides = isOwner;
  const { isPreviewMode } = usePreviewMode({ isMember: amMember, isLoading });

  const canJoin = useMemo(() => {
    if (!currentCampaign || !user) return false;
    if (amMember) return false;
    if (currentCampaign.status === 'FINISHED') return false;
    return true;
  }, [currentCampaign, user, amMember]);

  // Витягуємо статус pending-заявки поточного користувача (якщо він не член кампанії)
  const pendingRequestStatus = useMemo(() => {
    if (amMember) return null; // Вже місцевий — заявки немає
    if (!currentCampaign || !user) return null;

    return currentCampaign.viewer?.pendingJoinRequestStatus || null;
  }, [currentCampaign, user, amMember]);

  // === Дії ===
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

    const myMember = campaignMembers.find((m) => m.userId === user?.id);
    if (myMember) {
      await mutations.removeMember(myMember.userId);
      navigate('/');
      return { success: true };
    }

    return { success: false, message: 'Учасника кампанії не знайдено' };
  }, [campaignMembers, user, isCampaignFinished, mutations, navigate]);

  const handleRegenerateCode = useCallback(async () => {
    if (!canManageInviteCode) {
      return { success: false, message: 'Тільки власник може керувати кодом запрошення' };
    }
    await mutations.regenerateCode();
    return { success: true };
  }, [canManageInviteCode, mutations]);

  const handleRefreshCampaign = useCallback(async () => {
    // RQ handles refreshing automatically, but if needed we can trigger an invalidate here.
  }, []);

  const handleSaveSettings = useCallback(
    async (campaignData) => {
      if (!canManageCampaignSettings) {
        return { success: false, message: 'Тільки власник може змінювати налаштування кампанії' };
      }
      return await mutations.updateCampaign(campaignData);
    },
    [canManageCampaignSettings, mutations]
  );

  const handleTransferOwnership = useCallback(
    async (newOwnerId) => {
      if (!isOwner) {
        return { success: false, message: 'Тільки власник може передавати права кампанії' };
      }
      return await mutations.transferOwnership(Number(newOwnerId));
    },
    [isOwner, mutations]
  );

  const handleCancelForeignSession = useCallback(
    async (sessionId) => {
      return await mutations.cancelSession(Number(sessionId));
    },
    [mutations]
  );

  const handleDeleteForeignSession = useCallback(
    async (sessionId) => {
      return await mutations.deleteSession(Number(sessionId));
    },
    [mutations]
  );

  const handleViewProfile = useCallback((userId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('viewing', userId);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const handleBackFromProfile = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('viewing');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return {
    // Дані
    id: Number(id),
    user,
    currentCampaign,
    campaignMembers,

    // Стан
    isLoading,
    error,
    activeTab,
    setActiveTab,
    viewingUserId,
    isPreviewMode,

    // Ролі
    myRole,
    isOwner,
    isGM,
    canManageCampaignSettings,
    canManageCampaignVisibility,
    canAssignCampaignRoles,
    canModerateJoinRequests,
    canRemovePlayers,
    canCreateCampaignSessions,
    canManageInviteCode,
    canUseOwnerSessionOverrides,
    isCampaignFinished,
    amMember,
    canJoin,
  pendingRequestStatus,

    // Дії
    handleJoinRequest,
    handleLeave,
    handleRefreshCampaign,
    handleRegenerateCode,
    handleSaveSettings,
    handleTransferOwnership,
    handleCancelForeignSession,
    handleDeleteForeignSession,
    handleViewProfile,
    handleBackFromProfile,

    // Навігація
    navigate,
  };
}
