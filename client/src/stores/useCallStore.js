import { create } from 'zustand';

/**
 * @typedef {Object} Peer
 * @property {string} userId
 * @property {string} socketId
 * @property {boolean} micEnabled
 * @property {boolean} camEnabled
 */

export const useCallStore = create((set, get) => ({
  // Статуси
  callState: 'IDLE',
  connectionState: 'DISCONNECTED',
  
  // Внутрішні дані mediasoup
  device: null,
  sendTransport: null,
  recvTransport: null,
  
  // Локальні Audio/Video producer-и
  micProducer: null,
  camProducer: null,
  
  // Віддалені consumer-и (Map<consumerId, Consumer>)
  consumers: new Map(),
  
  // Стан
  peers: [],
  localMicEnabled: false,
  localCamEnabled: false,

  // Дії
  setCallState: (callState) => set({ callState }),
  setConnectionState: (connectionState) => set({ connectionState }),
  
  setDevice: (device) => set({ device }),
  setTransports: ({ sendTransport, recvTransport }) => set({ sendTransport, recvTransport }),
  
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
    if (state.peers.some(p => p.userId === peer.userId)) return state;
    return { peers: [...state.peers, peer] };
  }),
  
  removePeer: (userId) => set((state) => ({
    peers: state.peers.filter(p => p.userId !== userId)
  })),

  updatePeerMedia: (userId, { micEnabled, camEnabled }) => set((state) => ({
    peers: state.peers.map(p => 
      p.userId === userId 
        ? { ...p, micEnabled: micEnabled ?? p.micEnabled, camEnabled: camEnabled ?? p.camEnabled } 
        : p
    )
  })),

  reset: () => set({
    callState: 'IDLE',
    connectionState: 'DISCONNECTED',
    device: null,
    sendTransport: null,
    recvTransport: null,
    micProducer: null,
    camProducer: null,
    consumers: new Map(),
    peers: [],
    localMicEnabled: false,
    localCamEnabled: false,
  }),
  
  resetMedia: () => set({
    micProducer: null,
    camProducer: null,
    consumers: new Map(),
    localMicEnabled: false,
    localCamEnabled: false,
  })
}));
