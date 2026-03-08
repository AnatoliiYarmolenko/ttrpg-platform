import { create } from 'zustand';
import { apiAction } from '@/utils/apiAction';
import {
  createCampaign,
  getMyCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  transferCampaignOwnership,
  cancelCampaignSession,
  deleteCampaignSession,
  getCampaignMembers,
  addMemberToCampaign,
  removeMemberFromCampaign,
  updateMemberRole,
  regenerateInviteCode,
  joinByInviteCode,
  submitJoinRequest,
  getJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} from '../api/campaignApi';

/**
 * Zustand store для управління кампаніями.
 *
 * Всі API-дії використовують apiAction() helper для уніфікованої обробки
 * loading/error/success патерну.
 */
const useCampaignStore = create((set) => ({
  // === STATE ===

  campaigns: [],
  currentCampaign: null,
  campaignMembers: [],
  joinRequests: [],

  // Стан завантаження (гранулярний)
  isLoading: false,
  isLoadingMembers: false,
  isLoadingRequests: false,
  isLoadingAction: false,

  error: null,

  // === CRUD КАМПАНІЇ ===

  fetchMyCampaigns: async (role = 'all') =>
    apiAction(set, {
      apiCall: () => getMyCampaigns(role),
      onSuccess: (data) => set({ campaigns: data }),
      defaultError: 'Помилка при отриманні кампаній',
      silent: true,
    }),

  fetchCampaignById: async (campaignId) =>
    apiAction(set, {
      apiCall: () => getCampaignById(campaignId),
      onSuccess: (data) =>
        set({ currentCampaign: data, campaignMembers: [], joinRequests: [] }),
      defaultError: 'Помилка при отриманні деталей кампанії',
      silent: true,
    }),

  createNewCampaign: async (campaignData) =>
    apiAction(set, {
      apiCall: () => createCampaign(campaignData),
      onSuccess: (data) =>
        set((state) => ({ campaigns: [...state.campaigns, data] })),
      defaultError: 'Помилка при створенні кампанії',
      toastOnSuccess: true,
      successMessage: 'Кампанію успішно створено',
    }),

  updateCampaignData: async (campaignId, campaignData) =>
    apiAction(set, {
      apiCall: () => updateCampaign(campaignId, campaignData),
      onSuccess: (data) =>
        set((state) => ({
          campaigns: state.campaigns.map((c) =>
            c.id === campaignId ? data : c
          ),
          currentCampaign:
            state.currentCampaign?.id === campaignId
              ? data
              : state.currentCampaign,
        })),
      defaultError: 'Помилка при оновленні кампанії',
      toastOnSuccess: true,
      successMessage: 'Кампанію оновлено',
    }),

  deleteCampaignData: async (campaignId) =>
    apiAction(set, {
      apiCall: () => deleteCampaign(campaignId),
      onSuccess: () =>
        set((state) => ({
          campaigns: state.campaigns.filter((c) => c.id !== campaignId),
          currentCampaign:
            state.currentCampaign?.id === campaignId
              ? null
              : state.currentCampaign,
        })),
      defaultError: 'Помилка при видаленні кампанії',
      toastOnSuccess: true,
      successMessage: 'Кампанію видалено',
    }),

  transferOwnership: async (campaignId, newOwnerId) =>
    apiAction(set, {
      apiCall: () => transferCampaignOwnership(campaignId, newOwnerId),
      onSuccess: (data) =>
        set((state) => ({
          currentCampaign:
            state.currentCampaign?.id === campaignId
              ? data
              : state.currentCampaign,
          campaigns: state.campaigns.map((campaign) =>
            campaign.id === campaignId ? data : campaign
          ),
        })),
      defaultError: 'Помилка при передачі прав кампанії',
      toastOnSuccess: true,
      successMessage: 'Права власності передано',
    }),

  cancelSessionInCampaign: async (sessionId) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => cancelCampaignSession(sessionId),
      onSuccess: (data) =>
        set((state) => ({
          currentCampaign: state.currentCampaign
            ? {
                ...state.currentCampaign,
                sessions: (state.currentCampaign.sessions || []).map((session) =>
                  session.id === sessionId
                    ? {
                        ...session,
                        status: data?.status || 'CANCELED',
                      }
                    : session
                ),
              }
            : state.currentCampaign,
        })),
      defaultError: 'Помилка при скасуванні сесії',
      toastOnSuccess: true,
      successMessage: 'Сесію скасовано',
    }),

  deleteSessionInCampaign: async (sessionId) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => deleteCampaignSession(sessionId),
      onSuccess: () =>
        set((state) => ({
          currentCampaign: state.currentCampaign
            ? {
                ...state.currentCampaign,
                sessions: (state.currentCampaign.sessions || []).filter(
                  (session) => session.id !== sessionId
                ),
              }
            : state.currentCampaign,
        })),
      defaultError: 'Помилка при видаленні сесії',
      toastOnSuccess: true,
      successMessage: 'Сесію видалено',
    }),

  // === ЧЛЕНИ КАМПАНІЇ ===

  fetchCampaignMembers: async (campaignId) =>
    apiAction(set, {
      loadingKey: 'isLoadingMembers',
      apiCall: () => getCampaignMembers(campaignId),
      onSuccess: (data) => set({ campaignMembers: data }),
      defaultError: 'Помилка при отриманні членів кампанії',
      silent: true,
    }),

  addMember: async (campaignId, newMemberId, role = 'PLAYER') =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => addMemberToCampaign(campaignId, newMemberId, role),
      onSuccess: (data) =>
        set((state) => ({
          campaignMembers: [...state.campaignMembers, data],
        })),
      defaultError: 'Помилка при додаванні члена',
      toastOnSuccess: true,
      successMessage: 'Учасника додано до кампанії',
    }),

  removeMember: async (campaignId, memberId) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => removeMemberFromCampaign(campaignId, memberId),
      onSuccess: () =>
        set((state) => ({
          campaignMembers: state.campaignMembers.filter(
            (m) => m.userId !== memberId
          ),
        })),
      defaultError: 'Помилка при видаленні члена',
      toastOnSuccess: true,
      successMessage: 'Учасника видалено з кампанії',
    }),

  changeMemberRole: async (campaignId, memberId, role) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => updateMemberRole(campaignId, memberId, role),
      onSuccess: (data) =>
        set((state) => ({
          campaignMembers: state.campaignMembers.map((m) =>
            m.userId === memberId ? data : m
          ),
        })),
      defaultError: 'Помилка при зміні ролі члена',
      toastOnSuccess: true,
      successMessage: 'Роль учасника оновлено',
    }),

  // === КОДИ ЗАПРОШЕНЬ ===

  regenerateCode: async (campaignId) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => regenerateInviteCode(campaignId),
      onSuccess: (data) =>
        set((state) => ({
          currentCampaign:
            state.currentCampaign?.id === campaignId
              ? { ...state.currentCampaign, inviteCode: data.inviteCode }
              : state.currentCampaign,
          campaigns: state.campaigns.map((c) =>
            c.id === campaignId
              ? { ...c, inviteCode: data.inviteCode }
              : c
          ),
        })),
      defaultError: 'Помилка при регенерації коду запрошення',
      toastOnSuccess: true,
      successMessage: 'Код запрошення оновлено',
    }),

  joinByCode: async (inviteCode) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => joinByInviteCode(inviteCode),
      defaultError: 'Помилка при приєднанні за кодом',
      toastOnSuccess: true,
      successMessage: 'Запит на приєднання надіслано',
    }),

  // === ЗАПИТИ НА ПРИЄДНАННЯ ===

  fetchJoinRequests: async (campaignId) =>
    apiAction(set, {
      loadingKey: 'isLoadingRequests',
      apiCall: () => getJoinRequests(campaignId),
      onSuccess: (data) => set({ joinRequests: data }),
      defaultError: 'Помилка при отриманні запитів на приєднання',
      silent: true,
    }),

  submitRequest: async (campaignId, message = '') =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => submitJoinRequest(campaignId, message),
      defaultError: 'Помилка при надсиланні запиту',
      toastOnSuccess: true,
      successMessage: 'Запит на приєднання надіслано',
    }),

  approveRequest: async (requestId, role = 'PLAYER') =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => approveJoinRequest(requestId, role),
      onSuccess: () =>
        set((state) => ({
          joinRequests: state.joinRequests.filter((r) => r.id !== requestId),
        })),
      defaultError: 'Помилка при схвалюванні запиту',
      toastOnSuccess: true,
      successMessage: 'Запит схвалено',
    }),

  rejectRequest: async (requestId) =>
    apiAction(set, {
      loadingKey: 'isLoadingAction',
      apiCall: () => rejectJoinRequest(requestId),
      onSuccess: () =>
        set((state) => ({
          joinRequests: state.joinRequests.filter((r) => r.id !== requestId),
        })),
      defaultError: 'Помилка при відхиленні запиту',
      toastOnSuccess: true,
      successMessage: 'Запит відхилено',
    }),

  // === УТИЛИТИ ===

  clearError: () => set({ error: null }),
  clearCurrentCampaign: () => set({ currentCampaign: null }),

  reset: () =>
    set({
      campaigns: [],
      currentCampaign: null,
      campaignMembers: [],
      joinRequests: [],
      isLoading: false,
      isLoadingMembers: false,
      isLoadingRequests: false,
      isLoadingAction: false,
      error: null,
    }),
}));

export default useCampaignStore;
