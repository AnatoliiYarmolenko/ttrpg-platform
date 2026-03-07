import { useEffect, useCallback, useMemo, useState } from 'react';
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
    fetchParticipants,
    joinSessionAction,
    leaveSessionAction,
    updateSessionData,
    updateSessionStatusAction,
    cancelSessionAction,
    markSessionAsFinishedAction,
    deleteSessionById,
    updateParticipantStatusAction,
    isLoading,
    error,
    clearCurrentSession,
  } = useSessionStore();

  // Таби та перегляд профілю — обидва в URL, щоб перемикання було атомарним (без миготіння)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || TABS.DETAILS;
  const viewingUserId = Number(searchParams.get('viewing')) || null;
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());

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

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 60_000);

    return () => clearInterval(intervalId);
  }, []);

  // === Ролі та права ===
  const myRole = useMemo(() => {
    if (!currentSession || !user) return null;

    if (currentSession.ownerId === user.id) {
      return 'OWNER';
    }

    const participant = currentSession.participants?.find(
      (p) => p.userId === user.id
    );

    if (participant) return participant.role || 'PLAYER';

    return null;
  }, [currentSession, user]);

  const myParticipant = useMemo(() => {
    if (!currentSession || !user) return null;
    return currentSession.participants?.find((participant) => participant.userId === user.id) || null;
  }, [currentSession, user]);

  const amParticipant = useMemo(() => {
    if (!currentSession || !user) return false;
    return currentSession.participants?.some((p) => p.userId === user.id);
  }, [currentSession, user]);

  const confirmedGm = useMemo(() => {
    if (!currentSession?.participants) return null;
    return (
      currentSession.participants.find(
        (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
      ) || null
    );
  }, [currentSession]);

  const hasConfirmedGm = Boolean(confirmedGm);
  const isCampaignFinished = currentSession?.campaign?.status === 'FINISHED';

  const isOwner = currentSession?.ownerId === user?.id;
  const isGM = myParticipant?.role === 'GM';
  const isConfirmedGm = isGM && myParticipant?.status === 'CONFIRMED';

  const canStartSession = isConfirmedGm;
  const canFinishSession = isConfirmedGm;
  const canCancelSession = isOwner || (currentSession?.status === 'ACTIVE' && isConfirmedGm);
  const canManageStatus = canStartSession || canFinishSession || canCancelSession;
  const canManageParticipants = isOwner || isConfirmedGm;
  const canManageGmRequests = isOwner;

  const isSessionInPast = useMemo(() => {
    if (!currentSession?.date) return false;
    const sessionDate = new Date(currentSession.date);
    if (Number.isNaN(sessionDate.getTime())) return false;
    return sessionDate.getTime() < currentTimestamp;
  }, [currentSession, currentTimestamp]);
  const canManageSettings = (isOwner || isConfirmedGm) && !isSessionInPast && !isCampaignFinished;
  const { isPreviewMode } = usePreviewMode({ isMember: amParticipant, isLoading });

  useEffect(() => {
    if (activeTab === TABS.SETTINGS && !canManageSettings) {
      setActiveTab(TABS.DETAILS);
    }
  }, [activeTab, canManageSettings, setActiveTab]);

  const canJoin = useMemo(() => {
    if (!currentSession || !user) return false;
    if (amParticipant) return false;
    if (currentSession.status !== 'PLANNED') return false;
    if (currentSession.campaign?.status === 'FINISHED') return false;
    if (currentSession.maxPlayers) {
      const currentPlayers =
        currentSession.participants?.filter((p) => p.role === 'PLAYER').length || 0;
      if (currentPlayers >= currentSession.maxPlayers) return false;
    }
    return true;
  }, [currentSession, user, amParticipant]);

  const canApplyAsGm = useMemo(() => {
    if (!currentSession || !user) return false;
    if (amParticipant) return false;
    if (isOwner) return false;
    if (currentSession.status !== 'PLANNED') return false;
    if (currentSession.campaign?.status === 'FINISHED') return false;
    if (new Date(currentSession.date) < new Date()) return false;
    if (hasConfirmedGm) return false;
    return true;
  }, [currentSession, user, amParticipant, isOwner, hasConfirmedGm]);

  const refreshSessionWidgets = useCallback(async () => {
    if (!id) return;
    await Promise.all([
      fetchSessionById(id),
      fetchParticipants(id),
    ]);
  }, [id, fetchSessionById, fetchParticipants]);

  // === Дії ===
  const handleJoin = useCallback(
    async (payload = {}) => {
      const result = await joinSessionAction(id, payload);
      if (result?.success) await refreshSessionWidgets();
      return result;
    },
    [id, joinSessionAction, refreshSessionWidgets]
  );

  const handleApplyAsGm = useCallback(async () => {
    const result = await joinSessionAction(id, { role: 'GM' });
    if (result?.success) {
      await refreshSessionWidgets();
    }
    return result;
  }, [id, joinSessionAction, refreshSessionWidgets]);

  const handleLeave = useCallback(async () => {
    const result = await leaveSessionAction(id);
    if (result?.success) {
      await refreshSessionWidgets();
    }
    return result;
  }, [id, leaveSessionAction, refreshSessionWidgets]);

  const handleStatusChange = useCallback(
    async (newStatus) => {
      const action = newStatus === 'CANCELED'
        ? () => cancelSessionAction(id)
        : () => updateSessionStatusAction(id, newStatus);

      const result = await action();
      if (result?.success) {
        await fetchSessionById(id);
      }
      return result;
    },
    [id, updateSessionStatusAction, cancelSessionAction, fetchSessionById]
  );

  const handleSaveSettings = useCallback(
    async (sessionData) => {
      if (!canManageSettings) {
        return {
          success: false,
          message: isCampaignFinished
            ? 'Налаштування недоступні: кампанія завершена'
            : 'Налаштування недоступні для сесій у минулому',
        };
      }
      const result = await updateSessionData(id, sessionData);
      if (result?.success) await fetchSessionById(id);
      return result;
    },
    [id, canManageSettings, isCampaignFinished, updateSessionData, fetchSessionById]
  );

  const handleMarkAsFinished = useCallback(async () => {
    const result = await markSessionAsFinishedAction(id);
    if (result?.success) {
      await fetchSessionById(id);
    }
    return result;
  }, [id, markSessionAsFinishedAction, fetchSessionById]);

  const handleDelete = useCallback(async () => {
    await deleteSessionById(id);
    navigate('/');
  }, [id, deleteSessionById, navigate]);

  const handleParticipantStatusChange = useCallback(
    async (participantId, status) => {
      const result = await updateParticipantStatusAction(id, participantId, status);
      if (result?.success) {
        await fetchSessionById(id);
      }
      return result;
    },
    [id, updateParticipantStatusAction, fetchSessionById]
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
    canStartSession,
    canFinishSession,
    canCancelSession,
    canManageStatus,
    canManageParticipants,
    canManageGmRequests,
    canManageSettings,
    isCampaignFinished,
    isSessionInPast,
    amParticipant,
    canJoin,
    canApplyAsGm,
    hasConfirmedGm,
    confirmedGm,

    // Дії
    handleJoin,
    handleApplyAsGm,
    handleLeave,
    handleStatusChange,
    handleMarkAsFinished,
    handleSaveSettings,
    handleDelete,
    handleParticipantStatusChange,
    handleViewProfile,
    handleBackFromProfile,

    // Навігація
    navigate,
  };
}
