const { callRoomManager } = require('./call-room.manager');
const { CALL_STATES, CALL_EVENTS } = require('./call-events');
const mediasoupLib = require('../lib/mediasoup');
const { routerOptions } = require('../config/mediasoup.config');
const { logger } = require('../lib/logger');
const crypto = require('node:crypto');

function broadcastCallEvent(room, event, payload, excludeSocket = null) {
  const message = JSON.stringify({
    type: 'call:event',
    event,
    payload
  });

  for (const socket of room.sockets) {
    if (socket !== excludeSocket && socket.readyState === 1) {
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

      broadcastCallEvent(room, CALL_EVENTS.STARTED, { sessionId, callState: room.callState });

      return room;
    } catch (err) {
      logger.error({ err, sessionId }, 'Failed to start call');
      throw new Error('CALL_START_FAILED');
    }
  }

  endCall(sessionId) {
    const room = callRoomManager.getRoomIfExists(sessionId);
    
    if (room?.callState !== CALL_STATES.ACTIVE) {
      throw new Error('CALL_NOT_ACTIVE');
    }

    logger.info({ sessionId }, 'Ending call');
    
    broadcastCallEvent(room, CALL_EVENTS.ENDED, { sessionId });
    
    callRoomManager.destroyRoom(sessionId);
  }

  endCallIfActive(sessionId) {
    const room = callRoomManager.getRoomIfExists(sessionId);
    
    if (room?.callState === CALL_STATES.ACTIVE) {
      logger.info({ sessionId }, 'Ending active call automatically');
      broadcastCallEvent(room, CALL_EVENTS.ENDED, { sessionId });
      callRoomManager.destroyRoom(sessionId);
    }
  }

  joinCall(sessionId, userId, socket) {
    const room = callRoomManager.getRoomIfExists(sessionId);

    if (room?.callState !== CALL_STATES.ACTIVE) {
      throw new Error('CALL_NOT_ACTIVE');
    }

    callRoomManager.addSocket(sessionId, socket);

    const socketId = socket.id || crypto.randomUUID();
    socket.id = socketId;
    
    const peer = callRoomManager.addPeer(sessionId, userId, socketId, socket.user);

    broadcastCallEvent(room, CALL_EVENTS.PARTICIPANT_JOINED, {
      sessionId,
      participant: peer.summary
    }, socket);

    return {
      callState: room.callState,
      routerRtpCapabilities: room.router.rtpCapabilities,
      peers: Array.from(room.peers.values()).map(p => p.summary),
      myPeerId: socketId
    };
  }

  leaveCall(sessionId, userId, socket, isDisconnect = false) {
    const room = callRoomManager.getRoomIfExists(sessionId);
    
    if (!room) return;

    if (socket) {
      if (isDisconnect) {
        callRoomManager.removeSocket(sessionId, socket);
      }
      
      const peer = callRoomManager.getPeer(sessionId, socket.id);
      if (peer) {
        callRoomManager.removePeer(sessionId, socket.id);
        
        broadcastCallEvent(room, CALL_EVENTS.PARTICIPANT_LEFT, {
          sessionId,
          peerId: socket.id
        });
      }
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
