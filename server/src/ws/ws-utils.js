const { AppError, ERROR_CODES } = require('../constants/errors');

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

  if (socket.readyState === 1) { // 1 = OPEN
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

module.exports = {
  parseIncomingMessage,
  sendEvent,
  resolveErrorCode,
  resolveErrorMessage,
};
