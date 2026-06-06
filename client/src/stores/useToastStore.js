import { create } from 'zustand';

const DEFAULT_DURATION = 4000;
const MAX_VISIBLE_TOASTS = 5;

const generateToastId = () => crypto.randomUUID();

const normalizeToast = (payload = {}) => ({
  id: payload.id || generateToastId(),
  type: payload.type || 'info',
  title: payload.title || '',
  message: payload.message || '',
  duration:
    typeof payload.duration === 'number' ? payload.duration : DEFAULT_DURATION,
  dismissible: payload.dismissible !== false,
  createdAt: Date.now(),
});

const useToastStore = create((set) => ({
  toasts: [],

  addToast: (toastPayload) => {
    const nextToast = normalizeToast(toastPayload);

    set((state) => ({
      toasts: [...state.toasts, nextToast].slice(-MAX_VISIBLE_TOASTS),
    }));

    return nextToast.id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

const pushToast = (payload) => useToastStore.getState().addToast(payload);

export const toast = {
  success: (message, options = {}) =>
    pushToast({ ...options, message, type: 'success' }),

  error: (message, options = {}) =>
    pushToast({ ...options, message, type: 'error' }),

  warning: (message, options = {}) =>
    pushToast({ ...options, message, type: 'warning' }),

  info: (message, options = {}) =>
    pushToast({ ...options, message, type: 'info' }),

  dismiss: (id) => useToastStore.getState().removeToast(id),

  clear: () => useToastStore.getState().clearToasts(),
};

export default useToastStore;
