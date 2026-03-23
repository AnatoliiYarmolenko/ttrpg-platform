const Joi = require('joi');
const { validateQuery } = require('../middlewares/validation.middleware');

// === Валідація для пошуку кампаній ===

const searchCampaignsQuerySchema = Joi.object({
  q: Joi.string().trim().max(200).optional().messages({
    'string.max': 'Пошуковий запит не повинен перевищувати 200 символів',
  }),
  system: Joi.string().trim().max(50).optional().messages({
    'string.max': 'Система не повинна перевищувати 50 символів',
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
  system: Joi.string().trim().max(50).optional().messages({
    'string.max': 'Система не повинна перевищувати 50 символів',
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
  hasAvailableSlots: Joi.string().valid('true', 'false').optional().messages({
    'any.only': 'hasAvailableSlots повинна бути true або false',
  }),
  oneShot: Joi.string().valid('true', 'false').optional().messages({
    'any.only': 'oneShot повинна бути true або false',
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
});

const validateSearchSessions = [validateQuery(searchSessionsQuerySchema)];

module.exports = {
  validateSearchCampaigns,
  validateSearchSessions,
};
