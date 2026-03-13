const Joi = require('joi');

// ===== ПРАВИЛА ДЛЯ ПРОФІЛЮ =====

// Правило для displayName
const displayNameRule = Joi.string()
  .min(2)
  .max(50)
  .pattern(/^[a-zA-Z0-9_\-\sа-яА-ЯіІїЇєЄґҐ]+$/)
  .messages({
    'string.base': 'Ім\'я має бути рядком',
    'string.min': 'Мінімум 2 символи',
    'string.max': 'Максимум 50 символів',
    'string.pattern.base': 'Ім\'я може містити лише літери, цифри, пробіли, підкреслення та дефіси',
  });

// Правило для bio
const bioRule = Joi.string()
  .max(500)
  .allow('', null)
  .messages({
    'string.max': 'Біографія не може перевищувати 500 символів',
  });

// Правило для timezone (формат IANA: Europe/Kyiv, America/New_York)
const timezoneRule = Joi.string()
  .max(50)
  .pattern(/^[a-zA-Z_\/]+$/)
  .allow('', null)
  .messages({
    'string.max': 'Часовий пояс занадто довгий',
    'string.pattern.base': 'Невірний формат часового поясу',
  });

// Правило для мови (ISO 639-1: uk, en, pl)
const languageRule = Joi.string()
  .length(2)
  .pattern(/^[a-z]{2}$/)
  .messages({
    'string.length': 'Код мови має бути 2 символи',
    'string.pattern.base': 'Невірний код мови',
  });

// Правило для username (якщо дозволяємо змінювати)
const usernameRule = Joi.string()
  .min(3)
  .max(30)
  .pattern(/^[a-zA-Z0-9_\-]+$/)
  .messages({
    'string.min': 'Мінімум 3 символи',
    'string.max': 'Максимум 30 символів',
    'string.pattern.base': 'Username може містити лише латинські літери, цифри, підкреслення та дефіси',
  });

// Правило для avatarUrl
const avatarUrlRule = Joi.string()
  .uri()
  .max(500)
  .allow('', null)
  .messages({
    'string.uri': 'Невірний формат URL',
    'string.max': 'URL занадто довгий',
  });

// Схема оновлення профілю
const updateProfileSchema = Joi.object({
  displayName: displayNameRule.optional(),
  bio: bioRule.optional(),
  timezone: timezoneRule.optional(),
  language: languageRule.optional(),
  avatarUrl: avatarUrlRule.optional(),
}).min(1).messages({
  'object.min': 'Потрібно вказати хоча б одне поле для оновлення',
});

// Схема оновлення username (окремо, бо це sensitive операція)
const updateUsernameSchema = Joi.object({
  username: usernameRule.required(),
});

const userIdParamSchema = Joi.object({
  id: Joi.number().integer().positive().required().messages({
    'number.base': 'ID користувача повинен бути числом',
    'number.integer': 'ID користувача повинен бути цілим числом',
    'number.positive': 'ID користувача повинен бути позитивним',
    'any.required': 'ID користувача обов\'язковий',
  }),
});

module.exports = {
  updateProfileSchema,
  updateUsernameSchema,
  userIdParamSchema,
  displayNameRule,
  bioRule,
  timezoneRule,
  languageRule,
};
