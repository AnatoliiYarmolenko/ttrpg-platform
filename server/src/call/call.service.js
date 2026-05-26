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

  joinCall(sessionId, userId, socket) {
    const room = callRoomManager.getRoomIfExists(sessionId);

    if (room?.callState !== CALL_STATES.ACTIVE) {
      throw new Error('CALL_NOT_ACTIVE');
    }

    // Додаємо сокет у кімнату
    callRoomManager.addSocket(sessionId, socket);

    // Додаємо або оновлюємо peer
    // У WS сокету має бути унікальний id для розрізнення підключень
    const socketId = socket.id || Date.now().toString() + Math.random().toString();
    socket.id = socketId;
    
    const peer = callRoomManager.addPeer(sessionId, userId, socketId, socket.user);

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
      if (socket) {
        // 1. Видаляємо socketId з активних сокетів peer
        peer.socketIds.delete(socket.id);

        // 2. Закриваємо та видаляємо продюсери, створені цим сокетом
        for (const producer of Array.from(peer.producers.values())) {
          if (producer.appData?.socketId === socket.id) {
            producer.close();
            peer.removeProducer(producer.id);
            broadcastCallEvent(room, 'call:producerClosed', { producerId: producer.id, userId });
          }
        }

        // 3. Закриваємо та видаляємо консюмери, створені цим сокетом
        for (const consumer of Array.from(peer.consumers.values())) {
          if (consumer.appData?.socketId === socket.id) {
            consumer.close();
            peer.removeConsumer(consumer.id);
          }
        }

        // 4. Закриваємо та видаляємо транспорти, створені цим сокетом
        for (const transport of Array.from(peer.transports.values())) {
          if (transport.appData?.socketId === socket.id) {
            transport.close();
            peer.transports.delete(transport.id);
          }
        }

        // Оновлюємо стан медіа для інших користувачів, якщо він змінився
        broadcastCallEvent(room, 'call:media-state-changed', { userId, mediaState: peer.mediaState });

        // Якщо в цього користувача ще залишилися активні сокети/вкладки, не видаляємо peer повністю!
        if (peer.socketIds.size > 0) {
          // Оновлюємо socketId на один з існуючих активних
          peer.socketId = Array.from(peer.socketIds)[0];
          return;
        }
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
