import { useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import useSessionStore from '../store/useSessionStore';
import useAuthStore from '@/stores/useAuthStore';
import usePreviewMode from '@/hooks/usePreviewMode';
import { TABS } from '../components/navigation/SessionNavigation';

/**
 * useSessionPageController — основна логіка SessionPage.
 *
 * Інкапсулює:
 * - завантаження сесії
 * - обчислення ролей/прав (owner, GM, participant)
 * - логіку preview vs full mode
 * - синхронізацію ?tab із URL
 * - перегляд профілю учасника
 * - усі дії (join, leave, save, delete, тощо)
 *
 * @returns об'єкт із готовими пропсами для layout та віджетів
 */
export default function useSessionPageController() {
  const { id } = useParams();
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  const {
    currentSession,
    fetchSessionById,
    joinSessionAction,
    leaveSessionAction,
    updateSessionData,
    deleteSessionById,
    isLoading,
    error,
    clearCurrentSession,
  } = useSessionStore();

  // Таби та перегляд профілю — обидва в URL, щоб перемикання було атомарним (без миготіння)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || TABS.DETAILS;
  const viewingUserId = Number(searchParams.get('viewing')) || null;

  const setActiveTab = useCallback(
    (tab) => {
      // Закриває профіль і міняє таб в одному setSearchParams → один рендер
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
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Завантаження; скидання viewing при зміні id
  useEffect(() => {
    if (id) {
      fetchSessionById(id);
    }
    return () => {
      clearCurrentSession();
    };
  }, [id, fetchSessionById, clearCurrentSession]);

  // === Ролі та права ===
  const myRole = useMemo(() => {
    if (!currentSession || !user) return null;
    if (currentSession.campaign?.ownerId === user.id) return 'OWNER';
    const campaignMember = currentSession.campaign?.members?.find(
      (m) => m.userId === user.id
    );
    if (campaignMember?.role === 'GM') return 'GM';
    const participant = currentSession.participants?.find(
      (p) => p.userId === user.id
    );
    if (participant) return participant.role || 'PLAYER';
    if (currentSession.creatorId === user.id) return 'GM';
    return null;
  }, [currentSession, user]);

  const amParticipant = useMemo(() => {
    if (!currentSession || !user) return false;
    return currentSession.participants?.some((p) => p.userId === user.id);
  }, [currentSession, user]);

  const isOwner = myRole === 'OWNER';
  const isGM = myRole === 'GM';
  const canManage = isOwner || isGM;
  const { isPreviewMode } = usePreviewMode({ isMember: amParticipant, isLoading });

  const canJoin = useMemo(() => {
    if (!currentSession || !user) return false;
    if (amParticipant) return false;
    if (currentSession.status !== 'PLANNED') return false;
    if (currentSession.maxPlayers) {
      const currentPlayers =
        currentSession.participants?.filter((p) => p.role === 'PLAYER').length || 0;
      if (currentPlayers >= currentSession.maxPlayers) return false;
    }
    return true;
  }, [currentSession, user, amParticipant]);

  // === Дії ===
  const handleJoin = useCallback(
    async (characterName) => {
      const result = await joinSessionAction(id, {
        characterName: characterName || undefined,
      });
      if (result?.success) await fetchSessionById(id);
      return result;
    },
    [id, joinSessionAction, fetchSessionById]
  );

  const handleLeave = useCallback(async () => {
    await leaveSessionAction(id);
    await fetchSessionById(id);
  }, [id, leaveSessionAction, fetchSessionById]);

  const handleStatusChange = useCallback(
    async (newStatus) => {
      const result = await updateSessionData(id, { status: newStatus });
      if (result?.success) {
        await fetchSessionById(id);
      }
      return result;
    },
    [id, updateSessionData, fetchSessionById]
  );

  const handleSaveSettings = useCallback(
    async (sessionData) => {
      const result = await updateSessionData(id, sessionData);
      if (result?.success) await fetchSessionById(id);
      return result;
    },
    [id, updateSessionData, fetchSessionById]
  );

  const handleDelete = useCallback(async () => {
    await deleteSessionById(id);
    navigate('/');
  }, [id, deleteSessionById, navigate]);

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
    currentSession,

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
    amParticipant,
    canJoin,

    // Дії
    handleJoin,
    handleLeave,
    handleStatusChange,
    handleSaveSettings,
    handleDelete,
    handleViewProfile,
    handleBackFromProfile,

    // Навігація
    navigate,
  };
}
