/**
 * Central error handling middleware
 * Formats validation errors (from validation.middleware) and general errors
 */
const { AppError, ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } = require('../constants/errors');
const { logger } = require('../lib/logger');

const errorHandler = (err, req, res, next) => {
  // Якщо це AppError - використовуємо його структуру
  if (err instanceof AppError) {
    // Для rate limit помилок (429) - додаємо заголовок Retry-After
    if (err.status === HTTP_STATUS.TOO_MANY_REQUESTS && err.retryAfter) {
      res.set('Retry-After', err.retryAfter.toString());
    }
    
    // Логуємо серверні помилки
    if (err.status >= 500) {
      logger.error({
        code: err.code,
        message: err.message,
        stack: err.stack,
        timestamp: err.timestamp,
        path: req.path,
        method: req.method,
      }, 'Server Error');
    }
    
    return res.status(err.status).json(err.toJSON());
  }

  // Спеціальна обробка помилки CORS (з startup/cors.js)
  if (err.message === 'Не дозволено CORS') {
    return res.status(HTTP_STATUS.FORBIDDEN).json({ 
      error: ERROR_MESSAGES[ERROR_CODES.SECURITY_CORS_BLOCKED],
      code: ERROR_CODES.SECURITY_CORS_BLOCKED,
    });
  }

  // Визначаємо статус (якщо не заданий — то 500)
  const status = err.status || HTTP_STATUS.INTERNAL_SERVER_ERROR;

  // Для rate limit помилок (429) - додаємо заголовок Retry-After
  if (status === HTTP_STATUS.TOO_MANY_REQUESTS && err.retryAfter) {
    res.set('Retry-After', err.retryAfter.toString());
  }

  // Логуємо детальну помилку на сервері
  if (status >= 500) {
    logger.error({
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
    }, 'Server Error');
  }

  // Якщо є деталі валідації — повертаємо їх у стандартизованому виді
  if (err.details) {
    return res.status(status).json({ 
      error: err.message || ERROR_MESSAGES[ERROR_CODES.VALIDATION_FAILED],
      code: ERROR_CODES.VALIDATION_FAILED,
      details: err.details,
    });
  }

  // Для помилок сервера (500) — не розкриваємо деталі
  if (status >= 500) {
    return res.status(status).json({ 
      error: ERROR_MESSAGES[ERROR_CODES.SERVER_ERROR],
      code: ERROR_CODES.SERVER_ERROR,
    });
  }

  // Для помилок клієнта (4xx) — повертаємо користувацьке повідомлення
  return res.status(status).json({ 
    error: err.message || 'Сталася помилка',
    ...(err.code && { code: err.code }),
  });
};

module.exports = { errorHandler };