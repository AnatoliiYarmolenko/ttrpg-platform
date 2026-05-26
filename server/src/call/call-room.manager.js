const { CALL_STATES } = require('./call-events');
const { CallPeerState } = require('./call-peer.state');
const { logger } = require('../lib/logger');

class CallRoomManager {
  constructor() {
    // Map<sessionId, CallRoomState>
    this.rooms = new Map();
  }

  getRoom(sessionId) {
    let room = this.rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        callState: CALL_STATES.IDLE,
        sockets: new Set(),
        router: null,
        peers: new Map(), // userId -> CallPeerState
      };
      this.rooms.set(sessionId, room);
      logger.debug({ sessionId }, 'CallRoom created');
    }
    return room;
  }

  getRoomIfExists(sessionId) {
    return this.rooms.get(sessionId) || null;
  }

  hasRoom(sessionId) {
    return this.rooms.has(sessionId);
  }

  getPeer(sessionId, userId) {
    const room = this.rooms.get(sessionId);
    if (!room) return null;
    return room.peers.get(userId) || null;
  }

  addPeer(sessionId, userId, socketId, user = null) {
    const room = this.getRoom(sessionId);
    let peer = room.peers.get(userId);
    if (peer == null) {
      peer = new CallPeerState({ userId, socketId, user });
      room.peers.set(userId, peer);
      logger.debug({ sessionId, userId, socketId }, 'Peer added to CallRoom');
    } else {
      // Додаємо новий socketId до списку активних підключень
      peer.socketId = socketId;
      peer.socketIds.add(socketId);
      logger.debug({ sessionId, userId, socketId }, 'New socket connection added for existing peer');
    }
    return peer;
  }

  removePeer(sessionId, userId) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const peer = room.peers.get(userId);
    if (peer) {
      peer.closeAll();
      room.peers.delete(userId);
      logger.debug({ sessionId, userId }, 'Peer removed from CallRoom');
    }
  }

  addSocket(sessionId, socket) {
    const room = this.getRoom(sessionId);
    room.sockets.add(socket);
  }

  removeSocket(sessionId, socket) {
    const room = this.rooms.get(sessionId);
    if (room) {
      room.sockets.delete(socket);
    }
  }

  // Знищити кімнату та вивільнити всі ресурси
  destroyRoom(sessionId) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    // Закриваємо всі ресурси peer-ів
    for (const peer of room.peers.values()) {
      peer.closeAll();
    }
    room.peers.clear();

    // Закриваємо роутер mediasoup
    if (room.router) {
      room.router.close();
      room.router = null;
    }

    room.sockets.clear();
    room.callState = CALL_STATES.ENDED;
    
    logger.debug({ sessionId }, 'CallRoom destroyed');
  }

  // Очищення кімнати з пам'яті (коли сесія завершується або скасовується)
  deleteRoom(sessionId) {
    this.destroyRoom(sessionId);
    this.rooms.delete(sessionId);
  }
}

// Singleton екземпляр
const callRoomManager = new CallRoomManager();

module.exports = {
  callRoomManager,
  CallRoomManager
};
