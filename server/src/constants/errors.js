/**
 * Уніфіковані коди та повідомлення помилок
 * Централізоване управління помилками для всього API
 */

// ===== HTTP STATUS CODES =====
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ===== ERROR CODES =====
// Формат: CATEGORY_ACTION_REASON
const ERROR_CODES = {
  // ========== AUTH ERRORS ==========
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_REFRESH_TOKEN_EXPIRED: 'AUTH_REFRESH_TOKEN_EXPIRED',
  AUTH_REFRESH_TOKEN_REVOKED: 'AUTH_REFRESH_TOKEN_REVOKED',
  
  // ========== USER ERRORS ==========
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  USER_USERNAME_TAKEN: 'USER_USERNAME_TAKEN',
  USER_EMAIL_TAKEN: 'USER_EMAIL_TAKEN',
  
  // ========== PASSWORD ERRORS ==========
  PASSWORD_INVALID: 'PASSWORD_INVALID',
  PASSWORD_TOO_WEAK: 'PASSWORD_TOO_WEAK',
  PASSWORD_SAME_AS_CURRENT: 'PASSWORD_SAME_AS_CURRENT',
  PASSWORD_RESET_TOKEN_INVALID: 'PASSWORD_RESET_TOKEN_INVALID',
  PASSWORD_RESET_TOKEN_EXPIRED: 'PASSWORD_RESET_TOKEN_EXPIRED',
  
  // ========== EMAIL ERRORS ==========
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  EMAIL_SAME_AS_CURRENT: 'EMAIL_SAME_AS_CURRENT',
  EMAIL_VERIFICATION_FAILED: 'EMAIL_VERIFICATION_FAILED',
  EMAIL_CHANGE_TOKEN_INVALID: 'EMAIL_CHANGE_TOKEN_INVALID',
  EMAIL_CHANGE_TOKEN_EXPIRED: 'EMAIL_CHANGE_TOKEN_EXPIRED',
  
  // ========== VALIDATION ERRORS ==========
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',

  // ========== SESSION ERRORS ==========
  SESSION_START_ONLY_ON_SCHEDULED_DAY: 'SESSION_START_ONLY_ON_SCHEDULED_DAY',
  
  // ========== FILE UPLOAD ERRORS ==========
  FILE_INVALID_FORMAT: 'FILE_INVALID_FORMAT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_UPLOAD_FAILED: 'FILE_UPLOAD_FAILED',
  
  // ========== RATE LIMIT ERRORS ==========
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // ========== ADMIN ERRORS ==========
  ADMIN_ACCESS_DENIED: 'ADMIN_ACCESS_DENIED',
  ADMIN_CANNOT_DELETE_SELF: 'ADMIN_CANNOT_DELETE_SELF',
  ADMIN_RESOURCE_NOT_FOUND: 'ADMIN_RESOURCE_NOT_FOUND',
  
  // ========== SECURITY ERRORS ==========
  SECURITY_CSRF_INVALID: 'SECURITY_CSRF_INVALID',
  SECURITY_CORS_BLOCKED: 'SECURITY_CORS_BLOCKED',
  SECURITY_ACCESS_DENIED: 'SECURITY_ACCESS_DENIED',
  
  // ========== SERVER ERRORS ==========
  SERVER_ERROR: 'SERVER_ERROR',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
};

// ===== ERROR MESSAGES (Ukrainian) =====
const ERROR_MESSAGES = {
  // Auth
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Невірний логін або пароль',
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: 'Пошта не підтверджена. Перевірте свою електронну скриньку.',
  [ERROR_CODES.AUTH_TOKEN_MISSING]: 'Токен авторизації не надано',
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Невалідний токен авторизації',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Токен авторизації прострочено',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING]: 'Refresh token не надано',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID]: 'Невалідний refresh token',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED]: 'Refresh token прострочено',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED]: 'Refresh token відкликано',
  
  // User
  [ERROR_CODES.USER_NOT_FOUND]: 'Користувача не знайдено',
  [ERROR_CODES.USER_ALREADY_EXISTS]: 'Користувач вже існує',
  [ERROR_CODES.USER_USERNAME_TAKEN]: 'Цей нікнейм зайнятий',
  [ERROR_CODES.USER_EMAIL_TAKEN]: 'Цей email вже використовується',
  
  // Password
  [ERROR_CODES.PASSWORD_INVALID]: 'Невірний пароль',
  [ERROR_CODES.PASSWORD_TOO_WEAK]: 'Пароль занадто слабкий',
  [ERROR_CODES.PASSWORD_SAME_AS_CURRENT]: 'Новий пароль має відрізнятися від поточного',
  [ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID]: 'Невірний або прострочений токен скидання пароля',
  [ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED]: 'Токен скидання пароля прострочено',
  
  // Email
  [ERROR_CODES.EMAIL_SEND_FAILED]: 'Не вдалося відправити лист. Спробуйте пізніше.',
  [ERROR_CODES.EMAIL_SAME_AS_CURRENT]: 'Новий email має відрізнятися від поточного',
  [ERROR_CODES.EMAIL_VERIFICATION_FAILED]: 'Помилка верифікації email',
  [ERROR_CODES.EMAIL_CHANGE_TOKEN_INVALID]: 'Невірний токен зміни email',
  [ERROR_CODES.EMAIL_CHANGE_TOKEN_EXPIRED]: 'Токен зміни email прострочено',
  
  // Validation
  [ERROR_CODES.VALIDATION_FAILED]: 'Помилка валідації даних',
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'Обов\'язкове поле не заповнене',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Невірний формат даних',

  // Session
  [ERROR_CODES.SESSION_START_ONLY_ON_SCHEDULED_DAY]: 'Сесію можна розпочати тільки в день, на який вона запланована',
  
  // File
  [ERROR_CODES.FILE_INVALID_FORMAT]: 'Недопустимий формат файлу',
  [ERROR_CODES.FILE_TOO_LARGE]: 'Файл занадто великий',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: 'Помилка завантаження файлу',
  
  // Rate Limit
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Занадто багато запитів. Спробуйте пізніше.',
  
  // Admin
  [ERROR_CODES.ADMIN_ACCESS_DENIED]: 'Доступ дозволено лише адміністраторам',
  [ERROR_CODES.ADMIN_CANNOT_DELETE_SELF]: 'Неможливо видалити власний обліковий запис',
  [ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND]: 'Ресурс не знайдено',
  
  // Security
  [ERROR_CODES.SECURITY_CSRF_INVALID]: 'Невалідний CSRF токен',
  [ERROR_CODES.SECURITY_CORS_BLOCKED]: 'Доступ заборонено (CORS)',
  [ERROR_CODES.SECURITY_ACCESS_DENIED]: 'Доступ заборонено',
  
  // Server
  [ERROR_CODES.SERVER_ERROR]: 'Помилка сервера. Спробуйте пізніше.',
  [ERROR_CODES.SERVER_UNAVAILABLE]: 'Сервіс тимчасово недоступний',
  [ERROR_CODES.DATABASE_ERROR]: 'Помилка бази даних',
};

// ===== ERROR STATUS MAPPING =====
const ERROR_STATUS = {
  // Auth - 401/403
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: HTTP_STATUS.FORBIDDEN,
  [ERROR_CODES.AUTH_TOKEN_MISSING]: HTTP_STATUS.UNAUTHORIZED,
  [ERROR_CODES.AUTH_TOKEN_INVALID]: HTTP_STATUS.UNAUTHORIZED,
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: HTTP_STATUS.UNAUTHORIZED,
  [ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING]: HTTP_STATUS.UNAUTHORIZED,
  [ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID]: HTTP_STATUS.UNAUTHORIZED,
  [ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED]: HTTP_STATUS.UNAUTHORIZED,
  [ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED]: HTTP_STATUS.UNAUTHORIZED,
  
  // User - 400/404/409
  [ERROR_CODES.USER_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
  [ERROR_CODES.USER_ALREADY_EXISTS]: HTTP_STATUS.CONFLICT,
  [ERROR_CODES.USER_USERNAME_TAKEN]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.USER_EMAIL_TAKEN]: HTTP_STATUS.BAD_REQUEST,
  
  // Password - 400
  [ERROR_CODES.PASSWORD_INVALID]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.PASSWORD_TOO_WEAK]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.PASSWORD_SAME_AS_CURRENT]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED]: HTTP_STATUS.BAD_REQUEST,
  
  // Email - 400/500
  [ERROR_CODES.EMAIL_SEND_FAILED]: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  [ERROR_CODES.EMAIL_SAME_AS_CURRENT]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.EMAIL_VERIFICATION_FAILED]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.EMAIL_CHANGE_TOKEN_INVALID]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.EMAIL_CHANGE_TOKEN_EXPIRED]: HTTP_STATUS.BAD_REQUEST,
  
  // Validation - 400/422
  [ERROR_CODES.VALIDATION_FAILED]: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: HTTP_STATUS.BAD_REQUEST,

  // Session - 400
  [ERROR_CODES.SESSION_START_ONLY_ON_SCHEDULED_DAY]: HTTP_STATUS.BAD_REQUEST,
  
  // File - 400
  [ERROR_CODES.FILE_INVALID_FORMAT]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.FILE_TOO_LARGE]: HTTP_STATUS.BAD_REQUEST,
  [ERROR_CODES.FILE_UPLOAD_FAILED]: HTTP_STATUS.BAD_REQUEST,
  
  // Rate Limit - 429
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: HTTP_STATUS.TOO_MANY_REQUESTS,
  
  // Admin - 403/404
  [ERROR_CODES.ADMIN_ACCESS_DENIED]: HTTP_STATUS.FORBIDDEN,
  [ERROR_CODES.ADMIN_CANNOT_DELETE_SELF]: HTTP_STATUS.FORBIDDEN,
  [ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND]: HTTP_STATUS.NOT_FOUND,
  
  // Security - 403
  [ERROR_CODES.SECURITY_CSRF_INVALID]: HTTP_STATUS.FORBIDDEN,
  [ERROR_CODES.SECURITY_CORS_BLOCKED]: HTTP_STATUS.FORBIDDEN,
  [ERROR_CODES.SECURITY_ACCESS_DENIED]: HTTP_STATUS.FORBIDDEN,
  
  // Server - 500/503
  [ERROR_CODES.SERVER_ERROR]: HTTP_STATUS.INTERNAL_SERVER_ERROR,
  [ERROR_CODES.SERVER_UNAVAILABLE]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [ERROR_CODES.DATABASE_ERROR]: HTTP_STATUS.INTERNAL_SERVER_ERROR,
};

/**
 * Клас для створення стандартизованих помилок API
 */
class AppError extends Error {
  /**
   * @param {string} code - Код помилки з ERROR_CODES
   * @param {string} [customMessage] - Кастомне повідомлення (опційно)
   * @param {Object} [details] - Додаткові деталі помилки (опційно)
   */
  constructor(code, customMessage = null, details = null) {
    const message = customMessage || ERROR_MESSAGES[code] || 'Невідома помилка';
    super(message);
    
    this.code = code;
    this.status = ERROR_STATUS[code] || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Зберігаємо стек для debugging
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Перетворити в JSON для відповіді API
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    };
  }
}

/**
 * Фабричні функції для створення типових помилок
 */
const createError = {
  // Auth errors
  invalidCredentials: () => new AppError(ERROR_CODES.AUTH_INVALID_CREDENTIALS),
  emailNotVerified: () => new AppError(ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED),
  tokenMissing: () => new AppError(ERROR_CODES.AUTH_TOKEN_MISSING),
  tokenInvalid: () => new AppError(ERROR_CODES.AUTH_TOKEN_INVALID),
  tokenExpired: () => new AppError(ERROR_CODES.AUTH_TOKEN_EXPIRED),
  refreshTokenMissing: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING),
  refreshTokenInvalid: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID),
  refreshTokenExpired: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED),
  refreshTokenRevoked: () => new AppError(ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED),
  
  // User errors
  userNotFound: () => new AppError(ERROR_CODES.USER_NOT_FOUND),
  usernameTaken: () => new AppError(ERROR_CODES.USER_USERNAME_TAKEN),
  emailTaken: () => new AppError(ERROR_CODES.USER_EMAIL_TAKEN),
  
  // Password errors
  passwordInvalid: () => new AppError(ERROR_CODES.PASSWORD_INVALID),
  passwordSameAsCurrent: () => new AppError(ERROR_CODES.PASSWORD_SAME_AS_CURRENT),
  passwordResetTokenInvalid: () => new AppError(ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID),
  
  // Email errors
  emailSendFailed: () => new AppError(ERROR_CODES.EMAIL_SEND_FAILED),
  emailSameAsCurrent: () => new AppError(ERROR_CODES.EMAIL_SAME_AS_CURRENT),
  
  // Rate limit
  rateLimitExceeded: (retryAfter) => {
    const err = new AppError(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      `Занадто багато запитів. Спробуйте через ${retryAfter} секунд.`
    );
    err.retryAfter = retryAfter;
    return err;
  },
  
  // File errors
  fileInvalidFormat: (allowedFormats) => new AppError(
    ERROR_CODES.FILE_INVALID_FORMAT,
    `Недопустимий формат файлу. Дозволено: ${allowedFormats}`
  ),
  fileTooLarge: (maxSize) => new AppError(
    ERROR_CODES.FILE_TOO_LARGE,
    `Файл занадто великий. Максимальний розмір: ${maxSize}`
  ),
  
  // Server errors
  serverError: () => new AppError(ERROR_CODES.SERVER_ERROR),
  
  // Custom error
  custom: (code, message, details) => new AppError(code, message, details),
};

module.exports = {
  HTTP_STATUS,
  ERROR_CODES,
  ERROR_MESSAGES,
  ERROR_STATUS,
  AppError,
  createError,
};
