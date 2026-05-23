const { AppError, ERROR_CODES } = require('../constants/errors');
const { callService } = require('../call/call.service');
const { callRoomManager } = require('../call/call-room.manager');
const { webRtcTransportOptions } = require('../config/mediasoup.config');
const { CALL_STATES } = require('../call/call-events');
const sessionService = require('../services/session.service');

function parseIncomingMessage(raw) {
  let data = raw;

  if (Buffer.isBuffer(raw)) {
    data = raw.toString('utf8');
  }

  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невірний формат JSON');
    }
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невірний формат повідомлення');
  }

  const type = data.type;
  if (!type || typeof type !== 'string') {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Не вказано тип повідомлення');
  }

  let payload = {};
  if (data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
    payload = { ...data.payload };
  } else {
    payload = { ...data };
    delete payload.type;
    delete payload.payload;
  }

  return { type, payload };
}

function sendEvent(socket, type, payload = {}) {
  const message = {
    type,
    ...payload,
  };

  if (socket.readyState === 1 /* WebSocket.OPEN */) {
    socket.send(JSON.stringify(message));
  }
}

function resolveErrorCode(error) {
  if (error instanceof AppError) {
    return error.code;
  }
  if (error.message === 'CALL_NOT_ACTIVE') return ERROR_CODES.CALL_NOT_STARTED;
  return ERROR_CODES.SERVER_ERROR;
}

function resolveErrorMessage(error) {
  if (error instanceof AppError) {
    return error.message;
  }
  return error.message || 'Помилка сервера';
}

function createCallHandler({ logger } = {}) {
  return (socket) => {
    socket.on('message', async (raw) => {
      let type;
      let payload;

      try {
        ({ type, payload } = parseIncomingMessage(raw));
      } catch (error) {
        const code = resolveErrorCode(error);
        const message = resolveErrorMessage(error);
        sendEvent(socket, 'call:error', { code, message });
        return;
      }

      const sessionId = payload.sessionId;
      const userId = socket.user?.id;

      if (!sessionId) {
        sendEvent(socket, 'call:error', { code: ERROR_CODES.VALIDATION_FAILED, message: 'sessionId required', type });
        return;
      }

      try {
        if (['call:start', 'call:end', 'call:join', 'call:getCallState'].includes(type)) {
          let sessionPage;
          try {
            sessionPage = await sessionService.getSessionPageById(sessionId, userId);
          } catch (err) {
            throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Session not found');
          }

          if (type === 'call:start') {
            if (!sessionPage.actions.canStartCall) {
              throw new AppError(ERROR_CODES.CALL_START_FORBIDDEN, 'Start call forbidden');
            }
            const room = await callService.startCall(sessionId);
            sendEvent(socket, 'call:started', { sessionId, callState: room.callState });
            return;
          }

          if (type === 'call:end') {
            if (!sessionPage.actions.canEndCall) {
              throw new AppError(ERROR_CODES.CALL_END_FORBIDDEN, 'End call forbidden');
            }
            callService.endCall(sessionId);
            return;
          }

          if (type === 'call:join') {
            if (!sessionPage.actions.canJoinCall) {
              throw new AppError(ERROR_CODES.CALL_JOIN_FORBIDDEN, 'Join call forbidden');
            }
            socket.callSessionId = sessionId;
            const joinResult = callService.joinCall(sessionId, userId, socket);
            sendEvent(socket, 'call:joined', joinResult);
            return;
          }

          if (type === 'call:getCallState') {
            const canView = sessionPage.viewer.isSessionOwner || sessionPage.viewer.isParticipant;
            if (!canView) {
              throw new AppError(ERROR_CODES.CALL_JOIN_FORBIDDEN, 'View call state forbidden');
            }
            const state = callService.getCallState(sessionId);
            sendEvent(socket, 'call:callState', state);
            return;
          }
        }

        if (type === 'call:leave') {
          callService.leaveCall(sessionId, userId, socket);
          socket.callSessionId = null;
          return;
        }

        // WebRTC methods require active room and peer
        const room = callRoomManager.getRoomIfExists(sessionId);
        if (!room || room.callState !== CALL_STATES.ACTIVE) {
          throw new AppError(ERROR_CODES.CALL_NOT_STARTED, 'Call is not active');
        }

        const peer = room.peers.get(userId);
        if (!peer) {
          throw new AppError(ERROR_CODES.CALL_JOIN_FORBIDDEN, 'Peer not in call');
        }

        if (type === 'call:getRouterRtpCapabilities') {
          sendEvent(socket, 'call:routerRtpCapabilities', {
            routerRtpCapabilities: room.router.rtpCapabilities
          });
          return;
        }

        if (type === 'call:createWebRtcTransport') {
          const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
          
          transport.on('dtlsstatechange', dtlsState => {
            if (dtlsState === 'closed') transport.close();
          });
          
          peer.addTransport(transport);

          sendEvent(socket, 'call:webRtcTransportCreated', {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
            sctpParameters: transport.sctpParameters,
          });
          return;
        }

        if (type === 'call:connectWebRtcTransport') {
          const { transportId, dtlsParameters } = payload;
          const transport = peer.getTransport(transportId);
          if (!transport) throw new Error('Transport not found');
          
          await transport.connect({ dtlsParameters });
          sendEvent(socket, 'call:webRtcTransportConnected', { transportId });
          return;
        }

        if (type === 'call:produce') {
          const { transportId, kind, rtpParameters, appData } = payload;
          const transport = peer.getTransport(transportId);
          if (!transport) throw new Error('Transport not found');

          const producer = await transport.produce({ kind, rtpParameters, appData });
          
          // Broadcast to everyone else that a new producer is available
          producer.on('transportclose', () => {
             producer.close();
          });

          peer.addProducer(producer);

          sendEvent(socket, 'call:produced', { id: producer.id, kind });

          // Сповістити інших учасників про новий медіатрек
          const { broadcastCallEvent } = require('../call/call.service');
          broadcastCallEvent(room, 'call:newProducer', {
            producerId: producer.id,
            userId,
            kind
          }, socket);

          return;
        }

        if (type === 'call:consume') {
          const { transportId, producerId, rtpCapabilities } = payload;
          const transport = peer.getTransport(transportId);
          if (!transport) throw new Error('Transport not found');

          if (!room.router.canConsume({ producerId, rtpCapabilities })) {
            throw new Error('Cannot consume');
          }

          const consumer = await transport.consume({
            producerId,
            rtpCapabilities,
            paused: true // begin paused according to mediasoup best practices
          });
          
          consumer.on('transportclose', () => {
             consumer.close();
          });
          consumer.on('producerclose', () => {
             consumer.close();
             sendEvent(socket, 'call:consumerClosed', { consumerId: consumer.id });
          });

          peer.addConsumer(consumer);

          sendEvent(socket, 'call:consumed', {
            id: consumer.id,
            producerId: consumer.producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          });
          return;
        }

        if (type === 'call:resume') {
          const { consumerId } = payload;
          const consumer = peer.getConsumer(consumerId);
          if (!consumer) throw new Error('Consumer not found');

          await consumer.resume();
          sendEvent(socket, 'call:resumed', { consumerId });
          return;
        }

        sendEvent(socket, 'call:error', {
          code: ERROR_CODES.VALIDATION_FAILED,
          message: 'Невідомий тип повідомлення',
          type,
        });
      } catch (error) {
        const code = resolveErrorCode(error);
        const message = resolveErrorMessage(error);
        
        sendEvent(socket, 'call:error', { code, message, requestType: type });
        
        if (!(error instanceof AppError)) {
          logger?.error({ err: error, type }, 'WS call handler error');
        }
      }
    });

    socket.on('close', () => {
      if (socket.callSessionId && socket.user?.id) {
        callService.leaveCall(socket.callSessionId, socket.user.id, socket);
      }
    });
  };
}

module.exports = {
  createCallHandler,
  parseIncomingMessage,
};
