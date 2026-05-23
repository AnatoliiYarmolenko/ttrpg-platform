const { callRoomManager } = require('./call-room.manager');
const { CALL_STATES, CALL_EVENTS } = require('./call-events');
const mediasoupLib = require('../lib/mediasoup');
const { routerOptions } = require('../config/mediasoup.config');
const { logger } = require('../lib/logger');

// Допоміжна функція для надсилання подій всім учасникам
function broadcastCallEvent(room, event, payload, excludeSocket = null) {
  const message = JSON.stringify({
    type: 'call:event',
    event,
    payload
  });

  for (const socket of room.sockets) {
    if (socket !== excludeSocket && socket.readyState === 1 /* WebSocket.OPEN */) {
      socket.send(message);
    }
  }
}

class CallService {
  async startCall(sessionId) {
    const room = callRoomManager.getRoom(sessionId);

    if (room.callState === CALL_STATES.ACTIVE) {
      throw new Error('CALL_ALREADY_ACTIVE');
    }

    try {
      const worker = mediasoupLib.getWorker();
      room.router = await worker.createRouter(routerOptions);
      room.callState = CALL_STATES.ACTIVE;

      logger.info({ sessionId }, 'Call started successfully');

      broadcastCallEvent(room, CALL_EVENTS.STARTED, { sessionId });

      return room;
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to start call');
      throw new Error('CALL_START_FAILED');
    }
  }

  endCall(sessionId) {
    const room = callRoomManager.getRoomIfExists(sessionId);
    
    if (!room || room.callState !== CALL_STATES.ACTIVE) {
      throw new Error('CALL_NOT_ACTIVE');
    }

    logger.info({ sessionId }, 'Ending call');
    
    broadcastCallEvent(room, CALL_EVENTS.ENDED, { sessionId });
    
    callRoomManager.destroyRoom(sessionId);
  }

  joinCall(sessionId, userId, socket) {
    const room = callRoomManager.getRoomIfExists(sessionId);

    if (!room || room.callState !== CALL_STATES.ACTIVE) {
      throw new Error('CALL_NOT_ACTIVE');
    }

    // Додаємо сокет у кімнату
    callRoomManager.addSocket(sessionId, socket);

    // Додаємо або оновлюємо peer
    // У WS сокету має бути унікальний id для розрізнення підключень
    const socketId = socket.id || Date.now().toString() + Math.random().toString();
    socket.id = socketId;
    
    const peer = callRoomManager.addPeer(sessionId, userId, socketId);

    // Broadcast, що приєднався новий учасник
    broadcastCallEvent(room, CALL_EVENTS.PARTICIPANT_JOINED, {
      sessionId,
      participant: peer.summary
    }, socket);

    return {
      callState: room.callState,
      routerRtpCapabilities: room.router.rtpCapabilities,
      peers: Array.from(room.peers.values()).map(p => p.summary)
    };
  }

  leaveCall(sessionId, userId, socket) {
    const room = callRoomManager.getRoomIfExists(sessionId);
    
    if (!room) return;

    if (socket) {
      callRoomManager.removeSocket(sessionId, socket);
    }

    const peer = callRoomManager.getPeer(sessionId, userId);
    
    if (peer) {
      // Якщо вказаний сокет, і цей сокет вже не належить цьому peer 
      // (наприклад, peer перепідключився), то не видаляємо peer-а.
      if (socket && peer.socketId !== socket.id) {
        return;
      }
      
      callRoomManager.removePeer(sessionId, userId);
      
      broadcastCallEvent(room, CALL_EVENTS.PARTICIPANT_LEFT, {
        sessionId,
        userId
      });
    }
  }

  getCallState(sessionId) {
    const room = callRoomManager.getRoomIfExists(sessionId);
    
    if (!room) {
      return {
        callState: CALL_STATES.IDLE,
        peers: []
      };
    }
    
    return {
      callState: room.callState,
      peers: Array.from(room.peers.values()).map(p => p.summary)
    };
  }
}

const callService = new CallService();

module.exports = {
  callService,
  CallService,
  broadcastCallEvent
};
