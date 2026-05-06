import { create } from 'zustand';

const useNotificationStore = create((set) => ({
  // Connection state
  connectionState: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
  connectionError: null,

  // Live notifications (received via SSE/WebSocket)
  liveNotifications: [],

  // Optimistic unread count
  optimisticUnreadCount: null,

  // Actions
  setConnectionState: (state, error = null) => {
    set({
      connectionState: state,
      connectionError: error,
    });
  },

  addLiveNotification: (notification) => {
    set((state) => ({
      liveNotifications: [notification, ...state.liveNotifications].slice(0, 50),
    }));
  },

  clearLiveNotifications: () => {
    set({ liveNotifications: [] });
  },

  setOptimisticUnreadCount: (count) => {
    set({ optimisticUnreadCount: count });
  },

  clearOptimisticUnreadCount: () => {
    set({ optimisticUnreadCount: null });
  },

  // Optimistic update helpers
  incrementUnread: () => {
    set((state) => {
      const current = state.optimisticUnreadCount;
      if (current === null) return state;
      return { optimisticUnreadCount: current + 1 };
    });
  },

  decrementUnread: (amount = 1) => {
    set((state) => {
      const current = state.optimisticUnreadCount;
      if (current === null) return state;
      return { optimisticUnreadCount: Math.max(0, current - amount) };
    });
  },

  // Reset state
  reset: () => {
    set({
      connectionState: 'disconnected',
      connectionError: null,
      liveNotifications: [],
      optimisticUnreadCount: null,
    });
  },
}));

export default useNotificationStore;
