const Joi = require('joi');
const { validateQuery } = require('../middlewares/validation.middleware');
const { GAME_SYSTEM_VALUES } = require('../constants/game-systems');

// === Валідація для пошуку кампаній ===

const searchCampaignsQuerySchema = Joi.object({
  q: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Пошуковий запит не повинен перевищувати 200 символів',
  }),
  system: Joi.string().trim().valid(...GAME_SYSTEM_VALUES).empty('').optional().messages({
    'any.only': 'Невірна ігрова система',
  }),
  ownerUsername: Joi.string().trim().max(100).empty('').optional().messages({
    'string.max': 'Фільтр користувача не повинен перевищувати 100 символів',
  }),
  onlyMyParticipation: Joi.boolean().truthy('true').falsy('false').optional().messages({
    'boolean.base': 'onlyMyParticipation повинна бути true або false',
  }),
  limit: Joi.number().integer().min(1).max(50).optional().messages({
    'number.base': 'Limit повинен бути від 1 до 50',
    'number.min': 'Limit повинен бути від 1 до 50',
    'number.max': 'Limit повинен бути від 1 до 50',
  }),
  offset: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Offset повинен бути невід\'ємним числом',
    'number.min': 'Offset повинен бути невід\'ємним числом',
  }),
  sortBy: Joi.string().trim().valid('newest', 'popular', 'title').optional().messages({
    'any.only': 'Невірне значення sortBy',
  }),
});

const validateSearchCampaigns = [validateQuery(searchCampaignsQuerySchema)];

// === Валідація для пошуку сесій ===

const searchSessionsQuerySchema = Joi.object({
  q: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Пошуковий запит не повинен перевищувати 200 символів',
  }),
  system: Joi.string().trim().valid(...GAME_SYSTEM_VALUES).empty('').optional().messages({
    'any.only': 'Невірна ігрова система',
  }),
  ownerUsername: Joi.string().trim().max(100).empty('').optional().messages({
    'string.max': 'Фільтр користувача не повинен перевищувати 100 символів',
  }),
  onlyMyParticipation: Joi.boolean().truthy('true').falsy('false').optional().messages({
    'boolean.base': 'onlyMyParticipation повинна бути true або false',
  }),
  dateFrom: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'dateFrom повинна бути в форматі ISO8601',
  }),
  dateTo: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'dateTo повинна бути в форматі ISO8601',
  }),
  minPrice: Joi.number().min(0).optional().messages({
    'number.base': 'minPrice повинна бути невід\'ємним числом',
    'number.min': 'minPrice повинна бути невід\'ємним числом',
  }),
  maxPrice: Joi.number().min(0).optional().messages({
    'number.base': 'maxPrice повинна бути невід\'ємним числом',
    'number.min': 'maxPrice повинна бути невід\'ємним числом',
  }),
  hasAvailableSlots: Joi.boolean().truthy('true').falsy('false').optional().messages({
    'boolean.base': 'hasAvailableSlots повинна бути true або false',
  }),
  oneShot: Joi.boolean().truthy('true').falsy('false').optional().messages({
    'boolean.base': 'oneShot повинна бути true або false',
  }),
  limit: Joi.number().integer().min(1).max(50).optional().messages({
    'number.base': 'Limit повинен бути від 1 до 50',
    'number.min': 'Limit повинен бути від 1 до 50',
    'number.max': 'Limit повинен бути від 1 до 50',
  }),
  offset: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Offset повинен бути невід\'ємним числом',
    'number.min': 'Offset повинен бути невід\'ємним числом',
  }),
  sortBy: Joi.string().trim().valid('date', 'price', 'newest').optional().messages({
    'any.only': 'Невірне значення sortBy',
  }),
}).custom((value, helpers) => {
  if (value.dateFrom && value.dateTo) {
    const fromDate = new Date(value.dateFrom);
    const toDate = new Date(value.dateTo);

    if (fromDate > toDate) {
      return helpers.error('any.invalid', {
        message: 'dateFrom не може бути пізніше за dateTo',
      });
    }
  }

  if (value.minPrice !== undefined && value.maxPrice !== undefined && value.minPrice > value.maxPrice) {
    return helpers.error('any.invalid', {
      message: 'minPrice не може бути більшою за maxPrice',
    });
  }

  return value;
}).messages({
  'any.invalid': '{{#message}}',
});

const validateSearchSessions = [validateQuery(searchSessionsQuerySchema)];

module.exports = {
  validateSearchCampaigns,
  validateSearchSessions,
};
