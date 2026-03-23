const Joi = require('joi');
const { validateParams, validateQuery } = require('../../middlewares/validation.middleware');

const campaignSessionParamsSchema = Joi.object({
  campaignId: Joi.number().integer().min(1).required().messages({
    'number.base': 'campaignId повинен бути позитивним числом',
    'number.min': 'campaignId повинен бути позитивним числом',
  }),
});

const getCampaignSessionsQuerySchema = Joi.object({
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

const validateGetCampaignSessions = [
  validateParams(campaignSessionParamsSchema),
  validateQuery(getCampaignSessionsQuerySchema),
];

module.exports = {
  validateGetCampaignSessions,
};
