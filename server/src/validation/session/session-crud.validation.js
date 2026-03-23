const Joi = require('joi');
const { validateBody, validateParams, validateQuery } = require('../../middlewares/validation.middleware');

const STATUS_VALUES = ['PLANNED', 'ACTIVE', 'FINISHED', 'CANCELED'];
const VISIBILITY_VALUES = ['PUBLIC', 'PRIVATE', 'LINK_ONLY'];

const sessionIdParamsSchema = Joi.object({
  id: Joi.number().integer().min(1).required().messages({
    'number.base': 'ID сесії повинен бути позитивним числом',
    'number.min': 'ID сесії повинен бути позитивним числом',
  }),
});

const createSessionBodySchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required().messages({
    'string.empty': 'Назва сесії обов\'язкова',
    'string.min': 'Назва повинна містити від 3 до 150 символів',
    'string.max': 'Назва повинна містити від 3 до 150 символів',
    'any.required': 'Назва сесії обов\'язкова',
  }),
  description: Joi.string().trim().max(2000).optional().messages({
    'string.max': 'Опис не повинен перевищувати 2000 символів',
  }),
  date: Joi.string().isoDate().required().custom((value, helpers) => {
    const date = new Date(value);
    if (date < new Date()) {
      return helpers.error('any.invalid', { message: 'Дата сесії не може бути в минулому' });
    }
    return value;
  }).messages({
    'string.isoDate': 'Дата повинна бути в форматі ISO8601',
    'any.required': 'Дата сесії обов\'язкова',
    'any.invalid': '{{#message}}',
  }),
  duration: Joi.number().integer().min(30).max(480).optional().messages({
    'number.base': 'Тривалість повинна бути від 30 до 480 хвилин',
    'number.min': 'Тривалість повинна бути від 30 до 480 хвилин',
    'number.max': 'Тривалість повинна бути від 30 до 480 хвилин',
  }),
  maxPlayers: Joi.number().integer().min(1).max(20).optional().messages({
    'number.base': 'Максимум гравців повинна бути від 1 до 20',
    'number.min': 'Максимум гравців повинна бути від 1 до 20',
    'number.max': 'Максимум гравців повинна бути від 1 до 20',
  }),
  price: Joi.number().min(0).max(10000).optional().messages({
    'number.base': 'Ціна повинна бути від 0 до 10000',
    'number.min': 'Ціна повинна бути від 0 до 10000',
    'number.max': 'Ціна повинна бути від 0 до 10000',
  }),
  campaignId: Joi.number().integer().min(1).optional().messages({
    'number.base': 'campaignId повинен бути позитивним числом',
    'number.min': 'campaignId повинен бути позитивним числом',
  }),
  visibility: Joi.string().trim().valid(...VISIBILITY_VALUES).optional().custom((value, helpers) => {
    const payload = helpers.state.ancestors[0] || {};
    const hasCampaign = payload.campaignId !== undefined
      && payload.campaignId !== null
      && String(payload.campaignId).trim() !== '';

    if (hasCampaign && value === 'LINK_ONLY') {
      return helpers.error('any.invalid', { message: 'Для сесії в кампанії тип LINK_ONLY більше не підтримується' });
    }

    return value;
  }).messages({
    'any.only': 'Невірна видимість',
    'any.invalid': '{{#message}}',
  }),
  system: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Назва системи не повинна перевищувати 100 символів',
  }),
  isGm: Joi.boolean().optional().messages({
    'boolean.base': 'isGm повинен бути булевим значенням',
  }),
});

const updateSessionBodySchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).optional().messages({
    'string.min': 'Назва повинна містити від 3 до 150 символів',
    'string.max': 'Назва повинна містити від 3 до 150 символів',
  }),
  description: Joi.string().trim().max(2000).optional().messages({
    'string.max': 'Опис не повинен перевищувати 2000 символів',
  }),
  status: Joi.string().trim().valid(...STATUS_VALUES).optional().messages({
    'any.only': 'Невірний статус сесії',
  }),
  date: Joi.string().isoDate().optional().custom((value, helpers) => {
    const date = new Date(value);
    if (date < new Date()) {
      return helpers.error('any.invalid', { message: 'Дата сесії не може бути в минулому' });
    }
    return value;
  }).messages({
    'string.isoDate': 'Дата повинна бути в форматі ISO8601',
    'any.invalid': '{{#message}}',
  }),
  duration: Joi.number().integer().min(30).max(480).optional().messages({
    'number.base': 'Тривалість повинна бути від 30 до 480 хвилин',
    'number.min': 'Тривалість повинна бути від 30 до 480 хвилин',
    'number.max': 'Тривалість повинна бути від 30 до 480 хвилин',
  }),
  maxPlayers: Joi.number().integer().min(1).max(20).optional().messages({
    'number.base': 'Максимум гравців повинна бути від 1 до 20',
    'number.min': 'Максимум гравців повинна бути від 1 до 20',
    'number.max': 'Максимум гравців повинна бути від 1 до 20',
  }),
  price: Joi.number().min(0).max(10000).optional().messages({
    'number.base': 'Ціна повинна бути від 0 до 10000',
    'number.min': 'Ціна повинна бути від 0 до 10000',
    'number.max': 'Ціна повинна бути від 0 до 10000',
  }),
  visibility: Joi.string().trim().valid(...VISIBILITY_VALUES).optional().messages({
    'any.only': 'Невірна видимість',
  }),
  system: Joi.string().trim().max(100).optional().messages({
    'string.max': 'Назва системи не повинна перевищувати 100 символів',
  }),
});

const getMySessionsQuerySchema = Joi.object({
  status: Joi.string().trim().valid(...STATUS_VALUES).optional().messages({
    'any.only': 'Невірний статус фільтра',
  }),
  role: Joi.string().trim().valid('GM', 'PLAYER', 'ALL').optional().messages({
    'any.only': 'Невірна роль фільтра',
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.base': 'Limit повинен бути від 1 до 100',
    'number.min': 'Limit повинен бути від 1 до 100',
    'number.max': 'Limit повинен бути від 1 до 100',
  }),
  offset: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Offset повинен бути невід\'ємним числом',
    'number.min': 'Offset повинен бути невід\'ємним числом',
  }),
});

const validateCreateSession = [validateBody(createSessionBodySchema)];
const validateUpdateSession = [validateParams(sessionIdParamsSchema), validateBody(updateSessionBodySchema)];
const validateSessionId = [validateParams(sessionIdParamsSchema)];
const validateGetMySessions = [validateQuery(getMySessionsQuerySchema)];

module.exports = {
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validateGetMySessions,
};
