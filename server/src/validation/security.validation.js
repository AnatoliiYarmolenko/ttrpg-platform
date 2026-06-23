const Joi = require('joi');

// Правило для поточного пароля (тільки required, без pattern - будемо перевіряти хеш)
const currentPasswordRule = Joi.string()
  .min(1)
  .max(128)
  .messages({
    'string.empty': 'Поточний пароль обов\'язковий',
    'any.required': 'Поточний пароль обов\'язковий',
  });

// Правило для нового пароля (з валідацією складності)
const newPasswordRule = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-zа-яіїєґ])(?=.*[A-ZА-ЯІЇЄҐ])(?=.*\d).*$/)
  .messages({
    'string.empty': 'Новий пароль обов\'язковий',
    'string.min': 'Мінімум 8 символів',
    'string.max': 'Максимум 128 символів',
    'string.pattern.base': 'Пароль має містити великі та малі літери та хоча б одну цифру',
    'any.required': 'Новий пароль обов\'язковий',
  });


// Схема зміни пароля
const changePasswordSchema = Joi.object({
  currentPassword: currentPasswordRule.required(),
  newPassword: newPasswordRule.required(),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Паролі не співпадають',
      'string.empty': 'Підтвердження пароля обов\'язкове',
      'any.required': 'Підтвердження пароля обов\'язкове',
    }),
});

// Схема запиту зміни email
const requestEmailChangeSchema = Joi.object({
  password: currentPasswordRule.required(),
  newEmail: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Невірний формат email',
      'string.empty': 'Новий email обов\'язковий',
      'any.required': 'Новий email обов\'язковий',
    }),
});

// Схема підтвердження зміни email
const confirmEmailChangeSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Токен обов\'язковий',
      'any.required': 'Токен обов\'язковий',
    }),
});

// Схема видалення акаунту
const deleteAccountSchema = Joi.object({
  password: currentPasswordRule.required(),
  confirmation: Joi.string()
    .valid('ВИДАЛИТИ')
    .required()
    .messages({
      'any.only': 'Введіть "ВИДАЛИТИ" для підтвердження',
      'string.empty': 'Підтвердження обов\'язкове',
      'any.required': 'Підтвердження обов\'язкове',
    }),
});

module.exports = {
  changePasswordSchema,
  requestEmailChangeSchema,
  confirmEmailChangeSchema,
  deleteAccountSchema,
};
