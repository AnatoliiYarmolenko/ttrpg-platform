const { HTTP_STATUS } = require('./httpStatus');
const { ERROR_MESSAGES } = require('./messages');
const { ERROR_STATUS } = require('./status');

class AppError extends Error {
  constructor(code, customMessage = null, details = null) {
    const message = customMessage || ERROR_MESSAGES[code] || 'Невідома помилка';
    super(message);

    this.code = code;
    this.status = ERROR_STATUS[code] || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }
}

module.exports = { AppError };