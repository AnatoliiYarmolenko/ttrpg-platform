const Joi = require('joi');

// Спільні правила для полів аутентифікації
// Pattern дозволяє латинські літери, цифри, підкреслення, дефіси та українські літери
const usernameRule = Joi.string()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_\-а-яА-ЯіІїЇєЄґҐ]+$/)
  .messages({
    'string.base': 'Нікнейм має бути рядком',
    'string.empty': 'Нікнейм обов\'язковий',
    'string.min': 'Мінімум 3 символи',
    'string.max': 'Максимум 30 символів',
    'string.pattern.base': 'Нікнейм може містити лише літери, цифри, підкреслення та дефіси',
    'any.required': 'Нікнейм обов\'язковий',
  });

const emailRule = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .messages({
    'string.email': 'Невірний формат email',
    'string.empty': 'Email обов\'язковий',
    'any.required': 'Email обов\'язковий',
  });

const loginPasswordRule = Joi.string()
  .min(1)
  .max(128)
  .messages({
    'string.empty': 'Пароль обов\'язковий',
    'string.min': 'Пароль обов\'язковий',
    'string.max': 'Максимум 128 символів',
    'any.required': 'Пароль обов\'язковий',
  });

// Pattern для пароля: хоча б одна мала літера (латинська або українська), хоча б одна велика літера, хоча б одна цифра
const passwordRule = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-zа-яіїєґ])(?=.*[A-ZА-ЯІЇЄҐ])(?=.*\d).*$/)
  .messages({
    'string.empty': 'Пароль обов\'язковий',
    'string.min': 'Мінімум 8 символів',
    'string.max': 'Максимум 128 символів',
    'string.pattern.base': 'Пароль має містити великі та малі літери (латинські або українські) та хоча б одну цифру',
    'any.required': 'Пароль обов\'язковий',
  });

const registerSchema = Joi.object({
  username: usernameRule.required(),
  email: emailRule.required(),
  password: passwordRule.required(),
});

const loginSchema = Joi.object({
  email: emailRule.required(),
  password: loginPasswordRule.required(),
});

const forgotPasswordSchema = Joi.object({
  email: emailRule.required(),
});

const resetPasswordSchema = Joi.object({
  resetToken: Joi.string()
    .required()
    .messages({
      'string.empty': 'Токен ресету обов\'язковий',
      'any.required': 'Токен ресету обов\'язковий',
    }),
  newPassword: passwordRule.required(),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
