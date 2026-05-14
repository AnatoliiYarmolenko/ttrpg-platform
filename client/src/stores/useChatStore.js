import { create } from 'zustand';

const useChatStore = create((set) => ({
  // connecting | reconnecting | connected | disconnected | error
  connectionState: 'disconnected',
  connectionError: null,
  readonly: false,

  setConnectionState: (state, error = null) => {
    set({
      connectionState: state,
      connectionError: error,
    });
  },

  setReadonly: (readonly) => {
    set({ readonly: Boolean(readonly) });
  },

  reset: () => {
    set({
      connectionState: 'disconnected',
      connectionError: null,
      readonly: false,
    });
  },
}));

export default useChatStore;
