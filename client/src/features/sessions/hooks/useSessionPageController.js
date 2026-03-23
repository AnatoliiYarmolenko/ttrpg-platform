import { useEffect, useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSessionQuery, useSessionMutations } from './useSessionQueries';
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
  const sessionIdNumber = Number(id);
  const navigate = useNavigate();

  const user = useAuthStore((state) => state.user);
  
  // Validate that id is a proper positive integer
  const isValidId = Number.isInteger(sessionIdNumber) && sessionIdNumber > 0;
  const invalidIdError = !isValidId ? 'Сесія не знайдена' : null;
  
  const { data: currentSession, isLoading, error: queryError } = useSessionQuery(sessionIdNumber);
  // Normalize error to string: extract message from Error objects
  const normalizedError = queryError
    ? typeof queryError === 'string'
      ? queryError
      : queryError.message || String(queryError)
    : invalidIdError;
  const error = normalizedError;
  const mutations = useSessionMutations(sessionIdNumber);

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

  // Завантаження даних відбувається автоматично через useSessionQuery
  useEffect(() => {
    // Empty effect for compatibility
  }, [sessionIdNumber]);

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
  const canDeleteSession = isOwner && currentSession?.status === 'PLANNED';
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

  const showCampaignInfo = useMemo(() => {
    if (!currentSession?.campaign) return false;

    const isGuestViewForPublicCampaignSession = currentSession.visibility === 'PUBLIC'
      && currentSession.campaign?.visibility === 'LINK_ONLY'
      && currentSession.viewer?.isCampaignMember === false;

    return !isGuestViewForPublicCampaignSession;
  }, [currentSession]);

  // === Дії ===
  const handleJoin = useCallback(
    async (payload = {}) => {
      const result = await mutations.joinSession(payload);
      return result;
    },
    [mutations]
  );

  const handleApplyAsGm = useCallback(async () => {
    const result = await mutations.joinSession({ role: 'GM' });
    return result;
  }, [mutations]);

  const handleLeave = useCallback(async () => {
    const result = await mutations.leaveSession();
    if (result?.success) {
      navigate('/');
    }
    return result;
  }, [mutations, navigate]);

  const handleStatusChange = useCallback(
    async (newStatus) => {
      if (newStatus === 'CANCELED') {
        return await mutations.cancelSession();
      }
      return await mutations.updateStatus(newStatus);
    },
    [mutations]
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
      return await mutations.updateSession(sessionData);
    },
    [canManageSettings, isCampaignFinished, mutations]
  );

  const handleMarkAsFinished = useCallback(async () => {
    return await mutations.finishSession();
  }, [mutations]);

  const handleDelete = useCallback(async () => {
    const result = await mutations.deleteSession();
    if (result?.success) {
      navigate('/');
    }
    return result;
  }, [mutations, navigate]);

  const handleParticipantStatusChange = useCallback(
    async (participantId, status) => {
      return await mutations.updateParticipantStatus({ participantId, status });
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
    canDeleteSession,
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
    showCampaignInfo,

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
