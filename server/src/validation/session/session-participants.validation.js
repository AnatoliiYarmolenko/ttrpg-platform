const Joi = require('joi');
const { validateBody, validateParams } = require('../../middlewares/validation.middleware');

const sessionIdParamsSchema = Joi.object({
  id: Joi.number().integer().min(1).required().messages({
    'number.base': 'ID сесії повинен бути позитивним числом',
    'number.min': 'ID сесії повинен бути позитивним числом',
  }),
});

const participantParamsSchema = Joi.object({
  id: Joi.number().integer().min(1).required().messages({
    'number.base': 'ID сесії повинен бути позитивним числом',
    'number.min': 'ID сесії повинен бути позитивним числом',
  }),
  participantId: Joi.number().integer().min(1).required().messages({
    'number.base': 'ID учасника повинен бути позитивним числом',
    'number.min': 'ID учасника повинен бути позитивним числом',
  }),
});

const joinSessionBodySchema = Joi.object({
  role: Joi.string().trim().valid('PLAYER', 'GM').optional().messages({
    'any.only': 'role повинен бути PLAYER або GM',
  }),
});

const updateParticipantStatusBodySchema = Joi.object({
  status: Joi.string().trim().valid('PENDING', 'CONFIRMED', 'DECLINED').required().messages({
    'any.only': 'Невірний статус учасника',
    'any.required': 'Невірний статус учасника',
  }),
});

const validateJoinSession = [validateParams(sessionIdParamsSchema), validateBody(joinSessionBodySchema)];
const validateUpdateParticipantStatus = [
  validateParams(participantParamsSchema),
  validateBody(updateParticipantStatusBodySchema),
];
const validateRemoveParticipant = [validateParams(participantParamsSchema)];

module.exports = {
  validateJoinSession,
  validateUpdateParticipantStatus,
  validateRemoveParticipant,
};
