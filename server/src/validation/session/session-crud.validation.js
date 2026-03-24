const Joi = require('joi');
const { validateBody, validateParams, validateQuery } = require('../../middlewares/validation.middleware');
const { GAME_SYSTEM_VALUES } = require('../../constants/game-systems');

const STATUS_VALUES = ['PLANNED', 'ACTIVE', 'FINISHED', 'CANCELED'];
const VISIBILITY_VALUES = ['PUBLIC', 'PRIVATE', 'LINK_ONLY'];

const sessionIdParamsSchema = Joi.object({
  id: Joi.number().integer().min(1).required().messages({
    'number.base': 'Session ID must be a positive integer',
    'number.min': 'Session ID must be a positive integer',
  }),
});

const createSessionBodySchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).required().messages({
    'string.empty': 'Session title is required',
    'string.min': 'Session title must be between 3 and 150 characters',
    'string.max': 'Session title must be between 3 and 150 characters',
    'any.required': 'Session title is required',
  }),
  description: Joi.string().trim().max(2000).optional().messages({
    'string.max': 'Description must not exceed 2000 characters',
  }),
  date: Joi.string().isoDate().required().custom((value, helpers) => {
    const date = new Date(value);
    if (date < new Date()) {
      return helpers.error('any.invalid', { message: 'Session date cannot be in the past' });
    }
    return value;
  }).messages({
    'string.isoDate': 'Date must be in ISO8601 format',
    'any.required': 'Session date is required',
    'any.invalid': '{{#message}}',
  }),
  duration: Joi.number().integer().min(30).max(480).optional().messages({
    'number.base': 'Duration must be between 30 and 480 minutes',
    'number.min': 'Duration must be between 30 and 480 minutes',
    'number.max': 'Duration must be between 30 and 480 minutes',
  }),
  maxPlayers: Joi.number().integer().min(1).max(20).optional().messages({
    'number.base': 'Max players must be between 1 and 20',
    'number.min': 'Max players must be between 1 and 20',
    'number.max': 'Max players must be between 1 and 20',
  }),
  price: Joi.number().min(0).max(10000).optional().messages({
    'number.base': 'Price must be between 0 and 10000',
    'number.min': 'Price must be between 0 and 10000',
    'number.max': 'Price must be between 0 and 10000',
  }),
  campaignId: Joi.number().integer().min(1).optional().messages({
    'number.base': 'Campaign ID must be a positive integer',
    'number.min': 'Campaign ID must be a positive integer',
  }),
  visibility: Joi.string().trim().valid(...VISIBILITY_VALUES).optional().messages({
    'any.only': 'Invalid visibility value',
  }),
  system: Joi.string().trim().valid(...GAME_SYSTEM_VALUES).empty('').allow(null).optional().messages({
    'any.only': 'Invalid game system',
  }),
  isGm: Joi.boolean().optional().messages({
    'boolean.base': 'isGm must be a boolean',
  }),
}).custom((value, helpers) => {
  if (value.campaignId && value.visibility === 'LINK_ONLY') {
    return helpers.error('any.invalid', {
      message: 'LINK_ONLY is allowed only for one-shot sessions',
    });
  }

  return value;
}).messages({
  'any.invalid': '{{#message}}',
});

const updateSessionBodySchema = Joi.object({
  title: Joi.string().trim().min(3).max(150).optional().messages({
    'string.min': 'Session title must be between 3 and 150 characters',
    'string.max': 'Session title must be between 3 and 150 characters',
  }),
  description: Joi.string().trim().max(2000).optional().messages({
    'string.max': 'Description must not exceed 2000 characters',
  }),
  status: Joi.string().trim().valid(...STATUS_VALUES).optional().messages({
    'any.only': 'Invalid session status',
  }),
  date: Joi.string().isoDate().optional().custom((value, helpers) => {
    const date = new Date(value);
    if (date < new Date()) {
      return helpers.error('any.invalid', { message: 'Session date cannot be in the past' });
    }
    return value;
  }).messages({
    'string.isoDate': 'Date must be in ISO8601 format',
    'any.invalid': '{{#message}}',
  }),
  duration: Joi.number().integer().min(30).max(480).optional().messages({
    'number.base': 'Duration must be between 30 and 480 minutes',
    'number.min': 'Duration must be between 30 and 480 minutes',
    'number.max': 'Duration must be between 30 and 480 minutes',
  }),
  maxPlayers: Joi.number().integer().min(1).max(20).optional().messages({
    'number.base': 'Max players must be between 1 and 20',
    'number.min': 'Max players must be between 1 and 20',
    'number.max': 'Max players must be between 1 and 20',
  }),
  price: Joi.number().min(0).max(10000).optional().messages({
    'number.base': 'Price must be between 0 and 10000',
    'number.min': 'Price must be between 0 and 10000',
    'number.max': 'Price must be between 0 and 10000',
  }),
  visibility: Joi.string().trim().valid(...VISIBILITY_VALUES).optional().messages({
    'any.only': 'Invalid visibility value',
  }),
  system: Joi.string().trim().valid(...GAME_SYSTEM_VALUES).empty('').allow(null).optional().messages({
    'any.only': 'Invalid game system',
  }),
});

const getMySessionsQuerySchema = Joi.object({
  status: Joi.string().trim().valid(...STATUS_VALUES).optional().messages({
    'any.only': 'Invalid status filter',
  }),
  role: Joi.string().trim().valid('GM', 'PLAYER', 'ALL').optional().messages({
    'any.only': 'Invalid role filter',
  }),
  limit: Joi.number().integer().min(1).max(100).optional().messages({
    'number.base': 'Limit must be between 1 and 100',
    'number.min': 'Limit must be between 1 and 100',
    'number.max': 'Limit must be between 1 and 100',
  }),
  offset: Joi.number().integer().min(0).optional().messages({
    'number.base': 'Offset must be a non-negative integer',
    'number.min': 'Offset must be a non-negative integer',
  }),
});

const shareTokenParamsSchema = Joi.object({
  shareToken: Joi.string().trim().min(10).max(255).required().messages({
    'string.empty': 'shareToken is required',
    'string.min': 'shareToken must be between 10 and 255 characters',
    'string.max': 'shareToken must be between 10 and 255 characters',
    'any.required': 'shareToken is required',
  }),
});

const validateCreateSession = [validateBody(createSessionBodySchema)];
const validateUpdateSession = [validateParams(sessionIdParamsSchema), validateBody(updateSessionBodySchema)];
const validateSessionId = [validateParams(sessionIdParamsSchema)];
const validateGetMySessions = [validateQuery(getMySessionsQuerySchema)];
const validateSessionShareToken = [validateParams(shareTokenParamsSchema)];

module.exports = {
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validateGetMySessions,
  validateSessionShareToken,
};
