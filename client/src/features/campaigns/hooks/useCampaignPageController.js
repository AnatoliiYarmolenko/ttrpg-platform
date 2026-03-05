import { useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useCampaignStore from '../store/useCampaignStore';
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
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const {
    currentCampaign,
    campaignMembers,
    fetchCampaignById,
    fetchCampaignMembers,
    updateCampaignData,
    deleteCampaignData,
    transferOwnership,
    cancelSessionInCampaign,
    deleteSessionInCampaign,
    removeMember,
    submitRequest,
    regenerateCode,
    isLoading,
    error,
    clearCurrentCampaign,
  } = useCampaignStore();

  // Таби та перегляд профілю — обидва в URL, щоб перемикання було атомарним (без миготіння)
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Завантаження; скидання viewing при зміні id
  useEffect(() => {
    if (id) {
      fetchCampaignById(id);
      fetchCampaignMembers(id);
    }
    return () => {
      clearCurrentCampaign();
    };
  }, [id, fetchCampaignById, fetchCampaignMembers, clearCurrentCampaign]);


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
  const canManage = isOwner || isGM;
  const { isPreviewMode } = usePreviewMode({ isMember: amMember, isLoading });

  const canJoin = useMemo(() => {
    if (!currentCampaign || !user) return false;
    if (amMember) return false;
    return true;
  }, [currentCampaign, user, amMember]);

  // === Дії ===
  const handleJoinRequest = useCallback(
    async (message) => {
      const result = await submitRequest(Number(id), message);
      if (result?.success) return { success: true };
      return { success: false, error: result?.error || 'Помилка при подачі заявки' };
    },
    [id, submitRequest]
  );

  const handleLeave = useCallback(async () => {
    const myMember = campaignMembers.find((m) => m.userId === user?.id);
    if (myMember) {
      await removeMember(Number(id), myMember.userId);
      navigate('/');
    }
  }, [campaignMembers, user, id, removeMember, navigate]);

  const handleRegenerateCode = useCallback(async () => {
    await regenerateCode(Number(id));
    await fetchCampaignById(id);
  }, [id, regenerateCode, fetchCampaignById]);

  const handleRefreshCampaign = useCallback(async () => {
    await fetchCampaignById(id);
  }, [id, fetchCampaignById]);

  const handleSaveSettings = useCallback(
    async (campaignData) => {
      const result = await updateCampaignData(Number(id), campaignData);
      if (result?.success) await fetchCampaignById(id);
      return result;
    },
    [id, updateCampaignData, fetchCampaignById]
  );

  const handleDelete = useCallback(async () => {
    await deleteCampaignData(Number(id));
    navigate('/');
  }, [id, deleteCampaignData, navigate]);

  const handleTransferOwnership = useCallback(
    async (newOwnerId) => {
      const result = await transferOwnership(Number(id), Number(newOwnerId));
      if (result?.success) {
        await fetchCampaignById(id);
        await fetchCampaignMembers(id);
      }
      return result;
    },
    [id, transferOwnership, fetchCampaignById, fetchCampaignMembers]
  );

  const handleCancelForeignSession = useCallback(
    async (sessionId) => {
      const result = await cancelSessionInCampaign(Number(sessionId));
      if (result?.success) {
        await fetchCampaignById(id);
      }
      return result;
    },
    [id, cancelSessionInCampaign, fetchCampaignById]
  );

  const handleDeleteForeignSession = useCallback(
    async (sessionId) => {
      const result = await deleteSessionInCampaign(Number(sessionId));
      if (result?.success) {
        await fetchCampaignById(id);
      }
      return result;
    },
    [id, deleteSessionInCampaign, fetchCampaignById]
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
    canManage,
    amMember,
    canJoin,

    // Дії
    handleJoinRequest,
    handleLeave,
    handleRefreshCampaign,
    handleRegenerateCode,
    handleSaveSettings,
    handleDelete,
    handleTransferOwnership,
    handleCancelForeignSession,
    handleDeleteForeignSession,
    handleViewProfile,
    handleBackFromProfile,

    // Навігація
    navigate,
  };
}
