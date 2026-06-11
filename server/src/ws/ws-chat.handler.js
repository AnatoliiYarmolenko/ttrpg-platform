const { AppError, ERROR_CODES } = require('../constants/errors');
const chatService = require('../services/chat.service');
const { checkRateLimit } = require('../services/rate-limit.service');
const { parseIncomingMessage, sendEvent, resolveErrorCode, resolveErrorMessage } = require('./ws-utils');

function parseChatId(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'chatId повинен бути позитивним числом');
  }
  return parsed;
}

async function handleChatJoin(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  const joinState = await chatService.getChatJoinState(chatId, socket.user?.id);

  roomManager.joinRoom(chatId, socket);
  sendEvent(socket, 'chat:joined', {
    chatId,
    readonly: joinState.readonly,
    capabilities: joinState.capabilities,
    snapshotCursor: joinState.snapshotCursor || null,
  });
}

async function handleChatLeave(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);
  roomManager.leaveRoom(chatId, socket);
}

async function handleChatMessageSend(socket, payload, roomManager) {
  const chatId = parseChatId(payload.chatId);

  const rateLimitKey = String(socket.user?.id || 'unknown_ws_client');
  await checkRateLimit('chat_send_message', rateLimitKey, {
    maxRequests: 20,
    windowMs: 10 * 1000,
    blockDurationMs: 10 * 1000,
  });

  const { clientMessageId, content } = payload;
  const message = await chatService.createUserMessage(chatId, socket.user?.id, content);

  sendEvent(socket, 'chat:message:new', {
    message,
    clientMessageId: clientMessageId || null,
  });

  roomManager.broadcastExcept(chatId, {
    type: 'chat:message:new',
    message,
  }, socket);
}


const chatHandler = async (socket, type, payload, roomManager) => {
  switch (type) {
    case 'chat:join':
      await handleChatJoin(socket, payload, roomManager);
      break;
    case 'chat:leave':
      await handleChatLeave(socket, payload, roomManager);
      break;
    case 'chat:message:send':
      await handleChatMessageSend(socket, payload, roomManager);
      break;
    default:
      sendEvent(socket, 'chat:error', {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Невідомий тип повідомлення',
        chatId: payload?.chatId || null,
      });
  }
};

module.exports = {
  chatHandler,
};
