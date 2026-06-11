const { ERROR_CODES } = require('./codes');
const { AppError } = require('./app-error');

const createError = {
  invalidCredentials: () => new AppError(ERROR_CODES.AUTH_INVALID_CREDENTIALS),
  emailNotVerified: () => new AppError(ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED),
  tokenMissing: () => new AppError(ERROR_CODES.AUTH_TOKEN_MISSING),
  tokenInvalid: () => new AppError(ERROR_CODES.AUTH_TOKEN_INVALID),
  tokenExpired: () => new AppError(ERROR_CODES.AUTH_TOKEN_EXPIRED),
  refreshTokenMissing: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING),
  refreshTokenInvalid: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID),
  refreshTokenExpired: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED),
  refreshTokenRevoked: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED),

  userNotFound: () => new AppError(ERROR_CODES.USER_NOT_FOUND),
  usernameTaken: () => new AppError(ERROR_CODES.USER_USERNAME_TAKEN),
  emailTaken: () => new AppError(ERROR_CODES.USER_EMAIL_TAKEN),
  userBanned: () => new AppError(ERROR_CODES.USER_BANNED),

  walletNotFound: () => new AppError(ERROR_CODES.WALLET_NOT_FOUND),
  insufficientFunds: () => new AppError(ERROR_CODES.WALLET_INSUFFICIENT_FUNDS),
  invalidAmount: () => new AppError(ERROR_CODES.WALLET_INVALID_AMOUNT),

  passwordInvalid: () => new AppError(ERROR_CODES.PASSWORD_INVALID),
  passwordSameAsCurrent: () => new AppError(ERROR_CODES.PASSWORD_SAME_AS_CURRENT),
  passwordResetTokenInvalid: () => new AppError(ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID),

  emailSendFailed: () => new AppError(ERROR_CODES.EMAIL_SEND_FAILED),
  emailSameAsCurrent: () => new AppError(ERROR_CODES.EMAIL_SAME_AS_CURRENT),

  rateLimitExceeded: (retryAfter) => {
    const err = new AppError(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      `Занадто багато запитів. Спробуйте через ${retryAfter} секунд.`
    );
    err.retryAfter = retryAfter;
    return err;
  },

  rateLimitUnavailable: () => new AppError(ERROR_CODES.RATE_LIMIT_UNAVAILABLE),

  fileInvalidFormat: (allowedFormats) => new AppError(
    ERROR_CODES.FILE_INVALID_FORMAT,
    `Недопустимий формат файлу. Дозволено: ${allowedFormats}`
  ),

  fileTooLarge: (maxSize) => new AppError(
    ERROR_CODES.FILE_TOO_LARGE,
    `Файл занадто великий. Максимальний розмір: ${maxSize}`
  ),

  serverError: () => new AppError(ERROR_CODES.SERVER_ERROR),
  serverUnavailable: () => new AppError(ERROR_CODES.SERVER_UNAVAILABLE),

  custom: (code, message, details) => new AppError(code, message, details),
};

module.exports = { createError };