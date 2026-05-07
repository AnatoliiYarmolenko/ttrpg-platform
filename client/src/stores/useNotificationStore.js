import { create } from 'zustand';

const useNotificationStore = create((set) => ({
  // Connection state
  connectionState: 'disconnected', // 'disconnected' | 'connecting' | 'connected' | 'error'
  connectionError: null,

  // Live notifications (received via SSE/WebSocket)
  liveNotifications: [],

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

  // Reset state
  reset: () => {
    set({
      connectionState: 'disconnected',
      connectionError: null,
      liveNotifications: [],
    });
  },
}));

export default useNotificationStore;
