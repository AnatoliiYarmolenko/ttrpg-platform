import { create } from 'zustand';
import { apiAction } from '@/utils/apiAction';
import {
  createSession,
  getMySessions,
  getSessionById,
  updateSession,
  deleteSession,
  cancelSession,
  markSessionAsFinished,
  getCampaignSessions,
  getSessionParticipants,
  joinSession,
  leaveSession,
  updateParticipantStatus,
  removeParticipant,
} from '../api/sessionApi';

/**
 * Zustand store для управління сесіями.
 *
 * Всі API-дії використовують apiAction() helper для уніфікованої обробки
 * loading/error/success патерну.
 */
const useSessionStore = create((set, get) => ({
  // === STATE ===

  sessions: [],
  currentSession: null,
  participants: [],
  isLoading: false,
  error: null,

  // === УТИЛИТИ ===

  clearError: () => set({ error: null }),
  clearCurrentSession: () => set({ currentSession: null, participants: [] }),

  // === CRUD СЕСІЇ ===

  fetchMySessions: async (params = {}) =>
    apiAction(set, {
      apiCall: () => getMySessions(params),
      onSuccess: (data) => set({ sessions: data }),
      defaultError: 'Помилка при отриманні сесій',
      silent: true,
    }),

  fetchSessionById: async (sessionId) =>
    apiAction(set, {
      apiCall: () => getSessionById(sessionId),
      onSuccess: (data) => set({ currentSession: data }),
      defaultError: 'Помилка при отриманні деталей сесії',
      silent: true,
    }),

  createNewSession: async (sessionData) =>
    apiAction(set, {
      apiCall: () => createSession(sessionData),
      onSuccess: (data) =>
        set((state) => ({ sessions: [...state.sessions, data] })),
      defaultError: 'Помилка при створенні сесії',
      toastOnSuccess: true,
      successMessage: 'Сесію успішно створено',
    }),

  updateSessionData: async (sessionId, sessionData) =>
    apiAction(set, {
      apiCall: () => updateSession(sessionId, sessionData),
      onSuccess: (data) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? data : s
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? data
              : state.currentSession,
        })),
      defaultError: 'Помилка при оновленні сесії',
      toastOnSuccess: true,
      successMessage: 'Сесію оновлено',
    }),

  deleteSessionById: async (sessionId) =>
    apiAction(set, {
      apiCall: () => deleteSession(sessionId),
      onSuccess: () =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          currentSession:
            state.currentSession?.id === sessionId
              ? null
              : state.currentSession,
        })),
      defaultError: 'Помилка при видаленні сесії',
      toastOnSuccess: true,
      successMessage: 'Сесію видалено',
    }),

  /**
   * Оновити статус сесії (PLANNED | ACTIVE | FINISHED | CANCELED)
   */
  updateSessionStatusAction: async (sessionId, status) =>
    apiAction(set, {
      apiCall: () => updateSession(sessionId, { status }),
      onSuccess: (data) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? data : s
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? data
              : state.currentSession,
        })),
      defaultError: 'Помилка при оновленні статусу сесії',
      toastOnSuccess: true,
      successMessage: 'Статус сесії оновлено',
    }),

  /**
   * Скасувати сесію (soft delete через /sessions/:id/cancel)
   */
  cancelSessionAction: async (sessionId) =>
    apiAction(set, {
      apiCall: () => cancelSession(sessionId),
      onSuccess: (data) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? data : s
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? data
              : state.currentSession,
        })),
      defaultError: 'Помилка при скасуванні сесії',
      toastOnSuccess: true,
      successMessage: 'Сесію скасовано',
    }),

  /**
   * Позначити сесію як проведену (для минулих PLANNED сесій)
   */
  markSessionAsFinishedAction: async (sessionId) =>
    apiAction(set, {
      apiCall: () => markSessionAsFinished(sessionId),
      onSuccess: (data) =>
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? data : s
          ),
          currentSession:
            state.currentSession?.id === sessionId
              ? data
              : state.currentSession,
        })),
      defaultError: 'Помилка при позначенні сесії як проведеної',
      toastOnSuccess: true,
      successMessage: 'Сесію позначено як проведену',
    }),

  fetchCampaignSessions: async (campaignId, params = {}) =>
    apiAction(set, {
      apiCall: () => getCampaignSessions(campaignId, params),
      defaultError: 'Помилка при отриманні сесій кампанії',
      silent: true,
    }),

  // === УЧАСНИКИ ===

  fetchParticipants: async (sessionId) =>
    apiAction(set, {
      apiCall: () => getSessionParticipants(sessionId),
      onSuccess: (data) => set({ participants: data }),
      defaultError: 'Помилка при отриманні учасників',
      silent: true,
    }),

  joinSessionAction: async (sessionId, payload = {}) =>
    apiAction(set, {
      apiCall: () => joinSession(sessionId, payload),
      onSuccess: async () => {
        if (get().currentSession?.id === sessionId) {
          // Перезавантажити поточну сесію для отримання оновлених даних
          const response = await getSessionById(sessionId);
          if (response.success) {
            set({ currentSession: response.data });
          }
        }
      },
      defaultError: 'Помилка при приєднанні до сесії',
      toastOnSuccess: true,
      setErrorState: false,
    }),

  leaveSessionAction: async (sessionId) =>
    apiAction(set, {
      apiCall: () => leaveSession(sessionId),
      onSuccess: async () => {
        if (get().currentSession?.id === sessionId) {
          const response = await getSessionById(sessionId);
          if (response.success) {
            set({ currentSession: response.data });
          }
        }
      },
      defaultError: 'Помилка при виході з сесії',
      toastOnSuccess: true,
      successMessage: 'Ви покинули сесію',
      setErrorState: false,
    }),

  updateParticipantStatusAction: async (sessionId, participantId, status) =>
    apiAction(set, {
      apiCall: () => updateParticipantStatus(sessionId, participantId, status),
      onSuccess: () =>
        set((state) => ({
          participants: state.participants.map((p) =>
            p.id === participantId ? { ...p, status } : p
          ),
        })),
      defaultError: 'Помилка при оновленні статусу',
      toastOnSuccess: true,
      successMessage: 'Статус учасника оновлено',
    }),

  removeParticipantAction: async (sessionId, participantId) =>
    apiAction(set, {
      apiCall: () => removeParticipant(sessionId, participantId),
      onSuccess: () =>
        set((state) => ({
          participants: state.participants.filter(
            (p) => p.id !== participantId
          ),
        })),
      defaultError: 'Помилка при видаленні учасника',
      toastOnSuccess: true,
      successMessage: 'Учасника видалено',
    }),

  reset: () =>
    set({
      sessions: [],
      currentSession: null,
      participants: [],
      isLoading: false,
      error: null,
    }),
}));

export default useSessionStore;
