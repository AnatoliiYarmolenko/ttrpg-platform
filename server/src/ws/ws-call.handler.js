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

  const id = data.id;
  const method = data.method;

  let payload = {};
  if (data.payload && typeof data.payload === 'object' && !Array.isArray(data.payload)) {
    payload = { ...data.payload };
  } else {
    payload = { ...data };
    delete payload.type;
    delete payload.payload;
    delete payload.id;
    delete payload.method;
  }

  return { type, id, method, payload };
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

function sendError(socket, error, type) {
  const code = resolveErrorCode(error);
  const message = resolveErrorMessage(error);
  sendEvent(socket, 'call:error', { code, message, requestType: type });
}

async function handleSessionAction({ socket, type, payload, sessionId, userId, sendResponse, sendEvent }) {
  const sessionPage = await sessionService.getSessionPageById(sessionId, userId);

  switch (type) {
    case 'call:start': {
      if (!sessionPage.actions.canStartCall) {
        throw new AppError(ERROR_CODES.CALL_START_FORBIDDEN, 'Start call forbidden');
      }
      const room = await callService.startCall(sessionId);
      sendEvent(socket, 'call:started', { sessionId, callState: room.callState });
      sendResponse({ success: true });
      return true;
    }
    case 'call:end':
      if (!sessionPage.actions.canEndCall) {
        throw new AppError(ERROR_CODES.CALL_END_FORBIDDEN, 'End call forbidden');
      }
      callService.endCall(sessionId);
      sendResponse({ success: true });
      return true;
    case 'call:join': {
      if (!sessionPage.actions.canJoinCall) {
        throw new AppError(ERROR_CODES.CALL_JOIN_FORBIDDEN, 'Join call forbidden');
      }
      socket.callSessionId = sessionId;
      const joinData = callService.joinCall(sessionId, userId, socket);
      sendEvent(socket, 'call:joined', joinData);
      sendResponse(joinData);
      return true;
    }
    case 'call:getCallState': {
      const canView = sessionPage.viewer.isSessionOwner || sessionPage.viewer.isParticipant;
      if (!canView) {
        throw new AppError(ERROR_CODES.CALL_JOIN_FORBIDDEN, 'View call state forbidden');
      }

      socket.callSessionId = sessionId;
      callRoomManager.addSocket(sessionId, socket);

      const state = callService.getCallState(sessionId);
      sendEvent(socket, 'call:callState', state);
      sendResponse(state);
      return true;
    }
    default:
      return false;
  }
}

function ensureActiveCallRoom(sessionId, socketId) {
  const room = callRoomManager.getRoomIfExists(sessionId);
  if (room?.callState !== CALL_STATES.ACTIVE) {
    throw new AppError(ERROR_CODES.CALL_NOT_STARTED, 'Call is not active');
  }

  const peer = room.peers.get(socketId);
  if (!peer) {
    throw new AppError(ERROR_CODES.CALL_JOIN_FORBIDDEN, 'Peer not in call');
  }

  return { room, peer };
}

async function handleWebRtcAction({ socket, type, payload, sessionId, userId, sendResponse, sendEvent }) {
  const { room, peer } = ensureActiveCallRoom(sessionId, socket.id);

  switch (type) {
    case 'call:getRouterRtpCapabilities':
      sendResponse({ routerRtpCapabilities: room.router.rtpCapabilities });
      return true;
    case 'call:createWebRtcTransport': {
      const transport = await room.router.createWebRtcTransport(webRtcTransportOptions);
      transport.appData.socketId = socket.id;
      transport.on('dtlsstatechange', (dtlsState) => {
        if (dtlsState === 'closed' || dtlsState === 'failed') {
          transport.close();
          peer.transports.delete(transport.id);
        }
      });
      peer.addTransport(transport);
      const data = {
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
        sctpParameters: transport.sctpParameters,
      };
      sendEvent(socket, 'call:webRtcTransportCreated', data);
      sendResponse(data);
      return true;
    }
    case 'call:connectWebRtcTransport': {
      const { transportId, dtlsParameters } = payload;
      const transport = peer.getTransport(transportId);
      if (!transport) throw new Error('Transport not found');
      await transport.connect({ dtlsParameters });
      sendEvent(socket, 'call:webRtcTransportConnected', { transportId });
      sendResponse({ success: true });
      return true;
    }
    case 'call:produce': {
      const { transportId, kind, rtpParameters, appData } = payload;
      const transport = peer.getTransport(transportId);
      if (!transport) throw new Error('Transport not found');

      const producer = await transport.produce({ kind, rtpParameters, appData });
      producer.appData = { ...producer.appData, socketId: socket.id };
      producer.on('transportclose', () => {
        producer.close();
        peer.removeProducer(producer.id);

        const { broadcastCallEvent } = require('../call/call.service');
        broadcastCallEvent(room, 'call:producerClosed', { producerId: producer.id, peerId: socket.id });
        broadcastCallEvent(room, 'call:media-state-changed', { peerId: socket.id, mediaState: peer.mediaState });
      });
      peer.addProducer(producer);
      sendEvent(socket, 'call:produced', { id: producer.id, kind });
      sendResponse({ id: producer.id });

      const { broadcastCallEvent } = require('../call/call.service');
      broadcastCallEvent(room, 'call:newProducer', { producerId: producer.id, peerId: socket.id, kind }, socket);
      broadcastCallEvent(room, 'call:media-state-changed', { peerId: socket.id, mediaState: peer.mediaState }, socket);
      return true;
    }
    case 'call:closeProducer': {
      const { producerId } = payload;
      const producer = peer.getProducer(producerId);
      if (producer) {
        producer.close();
        peer.removeProducer(producerId);

        const { broadcastCallEvent } = require('../call/call.service');
        broadcastCallEvent(room, 'call:producerClosed', { producerId, peerId: socket.id }, socket);
        broadcastCallEvent(room, 'call:media-state-changed', { peerId: socket.id, mediaState: peer.mediaState }, socket);
      }
      sendEvent(socket, 'call:producerClosed', { producerId });
      sendResponse({ success: true });
      return true;
    }
    case 'call:setMediaState': {
      const { mediaState } = payload;
      Object.assign(peer.mediaState, mediaState);

      const { broadcastCallEvent } = require('../call/call.service');
      broadcastCallEvent(room, 'call:media-state-changed', { peerId: socket.id, mediaState: peer.mediaState }, socket);
      sendResponse({ success: true });
      return true;
    }
    case 'call:consume': {
      const { transportId, producerId, rtpCapabilities } = payload;
      const transport = peer.getTransport(transportId);
      if (!transport) throw new Error('Transport not found');

      if (!room.router.canConsume({ producerId, rtpCapabilities })) {
        throw new Error('Cannot consume');
      }

      const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
      consumer.appData = { ...consumer.appData, socketId: socket.id };
      consumer.on('transportclose', () => {
        consumer.close();
        peer.removeConsumer(consumer.id);
      });
      consumer.on('producerclose', () => {
        consumer.close();
        peer.removeConsumer(consumer.id);
        sendEvent(socket, 'call:consumerClosed', { consumerId: consumer.id });
      });

      peer.addConsumer(consumer);
      const data = {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      };
      sendEvent(socket, 'call:consumed', data);
      sendResponse(data);
      return true;
    }
    case 'call:resume': {
      const { consumerId } = payload;
      const consumer = peer.getConsumer(consumerId);
      if (!consumer) throw new Error('Consumer not found');

      await consumer.resume();
      sendEvent(socket, 'call:resumed', { consumerId });
      sendResponse({ success: true });
      return true;
    }
    default:
      return false;
  }
}

function createCallHandler({ logger } = {}) {
  return (socket) => {
    socket.on('message', async (raw) => {
      let type;
      let payload;
      let id;
      let method;

      try {
        ({ type, id, method, payload } = parseIncomingMessage(raw));
      } catch (error) {
        const code = resolveErrorCode(error);
        const errMessage = resolveErrorMessage(error);
        sendEvent(socket, 'call:error', { code, message: errMessage, id });
        return;
      }

      let isRpc = false;
      let actualType = type;
      let actualPayload = payload;

      if (type === 'call:request') {
        isRpc = true;
        actualType = method;
        actualPayload = payload || {};
      }

      const sessionId = actualPayload.sessionId;
      const userId = socket.user?.id;

      const sendResponse = (data) => {
        if (isRpc && id) {
          sendEvent(socket, 'call:response', { id, data });
        }
      };

      const sendRpcError = (error) => {
        const code = resolveErrorCode(error);
        const message = resolveErrorMessage(error);
        if (isRpc && id) {
          sendEvent(socket, 'call:error', { id, code, message });
        } else {
          sendEvent(socket, 'call:error', { code, message, requestType: actualType });
        }
      };

      if (!sessionId) {
        sendRpcError(new AppError(ERROR_CODES.VALIDATION_FAILED, 'sessionId required'));
        return;
      }

      try {
        if (await handleSessionAction({ socket, type: actualType, payload: actualPayload, sessionId, userId, sendResponse, sendEvent })) {
          return;
        }

        if (actualType === 'call:leave') {
          callService.leaveCall(sessionId, userId, socket, false); // isDisconnect = false
          sendResponse({ success: true });
          return;
        }

        if (await handleWebRtcAction({ socket, type: actualType, payload: actualPayload, sessionId, userId, sendResponse, sendEvent })) {
          return;
        }

        sendRpcError(new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невідомий тип повідомлення'));
      } catch (error) {
        sendRpcError(error);
        
        if (!(error instanceof AppError)) {
          logger?.error({ err: error, type: actualType }, 'WS call handler error');
        }
      }
    });

    socket.on('close', () => {
      if (socket.callSessionId && socket.user?.id) {
        callService.leaveCall(socket.callSessionId, socket.user.id, socket, true); // isDisconnect = true
      }
    });
  };
}

module.exports = {
  createCallHandler,
  parseIncomingMessage,
};
