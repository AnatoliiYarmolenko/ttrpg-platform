const { ERROR_CODES } = require('./codes');

const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Невірний логін або пароль',
  [ERROR_CODES.AUTH_EMAIL_NOT_VERIFIED]: 'Пошта не підтверджена. Перевірте свою електронну скриньку.',
  [ERROR_CODES.AUTH_TOKEN_MISSING]: 'Токен авторизації не надано',
  [ERROR_CODES.AUTH_TOKEN_INVALID]: 'Невалідний токен авторизації',
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: 'Токен авторизації прострочено',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING]: 'Refresh token не надано',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID]: 'Невалідний refresh token',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED]: 'Refresh token прострочено',
  [ERROR_CODES.AUTH_REFRESH_TOKEN_REVOKED]: 'Refresh token відкликано',

  [ERROR_CODES.USER_NOT_FOUND]: 'Користувача не знайдено',
  [ERROR_CODES.USER_ALREADY_EXISTS]: 'Користувач вже існує',
  [ERROR_CODES.USER_USERNAME_TAKEN]: 'Цей нікнейм зайнятий',
  [ERROR_CODES.USER_EMAIL_TAKEN]: 'Цей email вже використовується',

  [ERROR_CODES.PASSWORD_INVALID]: 'Невірний пароль',
  [ERROR_CODES.PASSWORD_TOO_WEAK]: 'Пароль занадто слабкий',
  [ERROR_CODES.PASSWORD_SAME_AS_CURRENT]: 'Новий пароль має відрізнятися від поточного',
  [ERROR_CODES.PASSWORD_RESET_TOKEN_INVALID]: 'Невірний або прострочений токен скидання пароля',
  [ERROR_CODES.PASSWORD_RESET_TOKEN_EXPIRED]: 'Токен скидання пароля прострочено',

  [ERROR_CODES.EMAIL_SEND_FAILED]: 'Не вдалося відправити лист. Спробуйте пізніше.',
  [ERROR_CODES.EMAIL_SAME_AS_CURRENT]: 'Новий email має відрізнятися від поточного',
  [ERROR_CODES.EMAIL_VERIFICATION_FAILED]: 'Помилка верифікації email',
  [ERROR_CODES.EMAIL_CHANGE_TOKEN_INVALID]: 'Невірний токен зміни email',
  [ERROR_CODES.EMAIL_CHANGE_TOKEN_EXPIRED]: 'Токен зміни email прострочено',

  [ERROR_CODES.VALIDATION_FAILED]: 'Помилка валідації даних',
  [ERROR_CODES.VALIDATION_REQUIRED_FIELD]: 'Обов\'язкове поле не заповнене',
  [ERROR_CODES.VALIDATION_INVALID_FORMAT]: 'Невірний формат даних',

  [ERROR_CODES.SESSION_START_ONLY_ON_SCHEDULED_DAY]: 'Сесію можна розпочати тільки в день, на який вона запланована',
  [ERROR_CODES.SESSION_MARK_FINISHED_TOO_EARLY]: 'Позначити сесію як проведену можна лише після завершення сесії та 2 годин очікування',
  [ERROR_CODES.SESSION_TIME_CONFLICT_OWNER]: 'На цей час вже запланована сесія',
  [ERROR_CODES.SESSION_TIME_CONFLICT_PLAYER]: 'На цей час вже запланована сесія',
  [ERROR_CODES.SESSION_OWNER_ONLY]: 'Дія доступна тільки власнику сесії',
  [ERROR_CODES.SESSION_GM_ONLY]: 'Дія доступна тільки підтвердженому GM',
  [ERROR_CODES.SESSION_GM_ALREADY_EXISTS]: 'У сесії вже є підтверджений GM',
  [ERROR_CODES.SESSION_NO_GM_KICK_ACTIVE]: 'Неможливо змінювати GM після початку або завершення сесії',
  [ERROR_CODES.SESSION_DELETE_FORBIDDEN]: 'Видаляти можна лише заплановані сесії',

  [ERROR_CODES.CAMPAIGN_TRANSFER_FAILED]: 'Не вдалося передати права власності кампанії',
  [ERROR_CODES.CAMPAIGN_OWNER_REQUIRED]: 'Дія доступна тільки власнику кампанії',
  [ERROR_CODES.CAMPAIGN_NOT_FOUND]: 'Кампанія не знайдена',
  [ERROR_CODES.CAMPAIGN_FINISHED]: 'Кампанія завершена і недоступна для цієї дії',

  [ERROR_CODES.FILE_INVALID_FORMAT]: 'Недопустимий формат файлу',
  [ERROR_CODES.FILE_TOO_LARGE]: 'Файл занадто великий',
  [ERROR_CODES.FILE_UPLOAD_FAILED]: 'Помилка завантаження файлу',

  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: 'Занадто багато запитів. Спробуйте пізніше.',
  [ERROR_CODES.RATE_LIMIT_UNAVAILABLE]: 'Сервіс обмеження запитів тимчасово недоступний. Спробуйте пізніше.',

  [ERROR_CODES.ADMIN_ACCESS_DENIED]: 'Доступ дозволено лише адміністраторам',
  [ERROR_CODES.ADMIN_CANNOT_DELETE_SELF]: 'Неможливо видалити власний обліковий запис',
  [ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND]: 'Ресурс не знайдено',

  [ERROR_CODES.SECURITY_CSRF_INVALID]: 'Невалідний CSRF токен',
  [ERROR_CODES.SECURITY_CORS_BLOCKED]: 'Доступ заборонено (CORS)',
  [ERROR_CODES.SECURITY_ACCESS_DENIED]: 'Недостатньо доступу',

  [ERROR_CODES.SERVER_ERROR]: 'Помилка сервера. Спробуйте пізніше.',
  [ERROR_CODES.SERVER_UNAVAILABLE]: 'Сервіс тимчасово недоступний',
  [ERROR_CODES.DATABASE_ERROR]: 'Помилка бази даних',
};

module.exports = { ERROR_MESSAGES };
