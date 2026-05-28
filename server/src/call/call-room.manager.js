const { CALL_STATES } = require('./call-events');
const { CallPeerState } = require('./call-peer.state');
const { logger } = require('../lib/logger');

class CallRoomManager {
  constructor() {
    // Map<sessionId, CallRoomState>
    this.rooms = new Map();
  }

  getRoom(sessionId) {
    sessionId = String(sessionId);
    let room = this.rooms.get(sessionId);
    if (!room) {
      room = {
        sessionId,
        callState: CALL_STATES.IDLE,
        sockets: new Set(),
        router: null,
        peers: new Map(), // socketId -> CallPeerState
        emptyTimeout: null,
      };
      this.rooms.set(sessionId, room);
      logger.debug({ sessionId }, 'CallRoom created');
    }
    return room;
  }

  getRoomIfExists(sessionId) {
    return this.rooms.get(String(sessionId)) || null;
  }

  hasRoom(sessionId) {
    return this.rooms.has(String(sessionId));
  }

  getPeer(sessionId, socketId) {
    const room = this.rooms.get(String(sessionId));
    if (!room) return null;
    return room.peers.get(socketId) || null;
  }

  addPeer(sessionId, userId, socketId, user = null) {
    sessionId = String(sessionId);
    const room = this.getRoom(sessionId);
    let peer = room.peers.get(socketId);
    if (peer == null) {
      peer = new CallPeerState({ userId, socketId, user });
      room.peers.set(socketId, peer);
      logger.debug({ sessionId, userId, socketId }, 'Peer added to CallRoom');
    }
    return peer;
  }

  removePeer(sessionId, socketId) {
    const room = this.rooms.get(String(sessionId));
    if (!room) return;

    const peer = room.peers.get(socketId);
    if (peer) {
      peer.closeAll();
      room.peers.delete(socketId);
      logger.debug({ sessionId, socketId }, 'Peer removed from CallRoom');
    }
  }

  addSocket(sessionId, socket) {
    sessionId = String(sessionId);
    const room = this.getRoom(sessionId);
    room.sockets.add(socket);

    // Cancel the empty room timeout if someone joins back
    if (room.emptyTimeout) {
      clearTimeout(room.emptyTimeout);
      room.emptyTimeout = null;
      logger.debug({ sessionId }, 'Room empty timeout cleared because a socket joined');
    }
  }

  removeSocket(sessionId, socket) {
    const room = this.rooms.get(String(sessionId));
    if (room) {
      room.sockets.delete(socket);
      this._checkAndCleanupEmptyRoom(sessionId);
    }
  }

  // Внутрішній метод: очищення порожньої кімнати з пам'яті
  _checkAndCleanupEmptyRoom(sessionId) {
    const room = this.rooms.get(String(sessionId));
    if (!room) return;

    if (room.sockets.size === 0 && room.peers.size === 0) {
      if (room.callState === CALL_STATES.ACTIVE) {
        // Grace period timeout for ACTIVE rooms (3 minutes)
        if (!room.emptyTimeout) {
          logger.debug({ sessionId }, 'Room is empty but ACTIVE. Starting 3-minute grace period timeout');
          room.emptyTimeout = setTimeout(() => {
            logger.info({ sessionId }, 'Room grace period expired. Destroying zombie call');
            this.deleteRoom(sessionId);
          }, 3 * 60 * 1000); // 3 minutes
        }
      } else {
        logger.debug({ sessionId }, 'Room is completely empty and inactive, deleting from memory immediately');
        this.deleteRoom(sessionId);
      }
    }
  }

  // Знищити кімнату та вивільнити всі ресурси
  destroyRoom(sessionId) {
    const room = this.rooms.get(String(sessionId));
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

    room.callState = CALL_STATES.ENDED;
    
    logger.debug({ sessionId }, 'CallRoom destroyed');
  }

  // Очищення кімнати з пам'яті (коли сесія завершується або скасовується)
  deleteRoom(sessionId) {
    sessionId = String(sessionId);
    const room = this.rooms.get(sessionId);
    if (room) {
      if (room.emptyTimeout) {
        clearTimeout(room.emptyTimeout);
        room.emptyTimeout = null;
      }
      room.sockets.clear();
    }
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
