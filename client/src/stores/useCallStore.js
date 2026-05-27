import { create } from 'zustand';

/**
 * @typedef {Object} Peer
 * @property {string} userId
 * @property {string} socketId
 * @property {boolean} micEnabled
 * @property {boolean} camEnabled
 */

export const useCallStore = create((set, get) => ({
  // 1. Ідентифікатор поточної сесії дзвінка
  activeSessionId: null,
  myPeerId: null,

  // 2. Розділені статуси
  connectionState: 'DISCONNECTED', // CONNECTED, DISCONNECTED
  presenceState: 'NOT_JOINED',     // NOT_JOINED, JOINING, JOINED, LEAVING
  callState: 'IDLE',               // IDLE, ACTIVE, ENDED
  
  // Внутрішні дані mediasoup
  device: null,
  sendTransport: null,
  recvTransport: null,
  
  // Локальні Audio/Video producer-и
  micProducer: null,
  camProducer: null,
  localMicEnabled: false,
  localCamEnabled: false,
  
  // Віддалені consumer-и (Map<consumerId, Consumer>)
  consumers: new Map(),
  
  // Стан учасників
  peers: [], // [{ userId, username, avatar, micEnabled, camEnabled }]
  
  // UX states
  isStarting: false,
  mediaPermissionError: false,

  // Setters
  setActiveSessionId: (activeSessionId) => set({ activeSessionId: activeSessionId ? Number(activeSessionId) : null }),
  setMyPeerId: (myPeerId) => set({ myPeerId }),
  setConnectionState: (state) => set({ connectionState: state }),
  setPresenceState: (state) => set({ presenceState: state }),
  setCallState: (state) => set({ callState: state }),
  
  setDevice: (device) => set({ device }),
  setTransports: ({ sendTransport, recvTransport }) => set({ sendTransport, recvTransport }),
  setIsStarting: (isStarting) => set({ isStarting }),
  setMediaPermissionError: (mediaPermissionError) => set({ mediaPermissionError }),
  
  setMicProducer: (micProducer) => set({ micProducer, localMicEnabled: !!micProducer }),
  setCamProducer: (camProducer) => set({ camProducer, localCamEnabled: !!camProducer }),
  
  addConsumer: (consumer) => {
    const newConsumers = new Map(get().consumers);
    newConsumers.set(consumer.id, consumer);
    set({ consumers: newConsumers });
  },
  
  removeConsumer: (consumerId) => {
    const newConsumers = new Map(get().consumers);
    newConsumers.delete(consumerId);
    set({ consumers: newConsumers });
  },

  setPeers: (peers) => set({ peers }),
  
  addPeer: (peer) => set((state) => {
    if (state.peers.some(p => p.peerId === peer.peerId)) return state;
    return { peers: [...state.peers, peer] };
  }),
  
  removePeer: (peerId) => set((state) => ({
    peers: state.peers.filter(p => p.peerId !== peerId)
  })),

  updatePeerMedia: (peerId, { micEnabled, camEnabled }) => set((state) => ({
    peers: state.peers.map(p => 
      p.peerId === peerId 
        ? { ...p, micEnabled: micEnabled ?? p.micEnabled, camEnabled: camEnabled ?? p.camEnabled } 
        : p
    )
  })),

  // ==========================================
  // Global Cleanup API
  // ==========================================
  
  joinCallSession: (sessionId) => {
    set({ 
      activeSessionId: sessionId ? Number(sessionId) : null, 
      presenceState: 'JOINING' 
    });
  },

  leaveCallSession: () => {
    set({ presenceState: 'LEAVING' });
  },

  disconnectAndCleanup: (forceFullCleanup = false) => {
    const state = get();
    const isOnSessionPage = globalThis.location?.pathname?.includes(`/session/${state.activeSessionId}`);
    
    state.cleanupCallMedia();
    
    if (isOnSessionPage && !forceFullCleanup) {
      // Якщо користувач на сторінці сесії, зберігаємо WS з'єднання у режимі глядача
      set({
        presenceState: 'NOT_JOINED',
        peers: [],
      });
    } else {
      // Якщо користувач пішов зі сторінки, повністю розриваємо з'єднання
      set({
        activeSessionId: null,
        myPeerId: null,
        callState: 'IDLE',
        connectionState: 'DISCONNECTED',
        presenceState: 'NOT_JOINED',
        peers: [],
      });
    }
  },

  cleanupCallMedia: () => {
    const state = get();
    
    // Clean up mediasoup resources
    if (state.sendTransport) state.sendTransport.close();
    if (state.recvTransport) state.recvTransport.close();
    
    // Producers should be stopped
    if (state.micProducer) {
      state.micProducer.track?.stop();
      state.micProducer.close();
    }
    if (state.camProducer) {
      state.camProducer.track?.stop();
      state.camProducer.close();
    }
    
    // Consumers
    for (const consumer of state.consumers.values()) {
      consumer.close();
    }

    set({
      device: null,
      sendTransport: null,
      recvTransport: null,
      micProducer: null,
      camProducer: null,
      consumers: new Map(),
      localMicEnabled: false,
      localCamEnabled: false,
      mediaPermissionError: false,
    });
  },

  // Backward compatibility aliases if needed (temporarily, until we refactor all calls)
  cleanupCallConnection: () => get().disconnectAndCleanup(),
  resetMedia: () => get().cleanupCallMedia(),
  reset: () => get().disconnectAndCleanup(),
  setIsJoining: (isJoining) => set({ presenceState: isJoining ? 'JOINING' : 'NOT_JOINED' })
}));
