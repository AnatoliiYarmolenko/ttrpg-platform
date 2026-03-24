const Joi = require('joi');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validation.middleware');
const { GAME_SYSTEM_VALUES } = require('../constants/game-systems');

const createCampaignBodySchema = Joi.object({
  title: Joi.string().trim().min(3).max(100).required().messages({
    'string.empty': 'Назва кампанії обов\'язкова',
    'string.min': 'Назва повинна містити від 3 до 100 символів',
    'string.max': 'Назва повинна містити від 3 до 100 символів',
    'any.required': 'Назва кампанії обов\'язкова',
  }),
  description: Joi.string().trim().max(1000).optional().messages({
    'string.max': 'Опис не повинен перевищувати 1000 символів',
  }),
  imageUrl: Joi.string().trim().uri().optional().messages({
    'string.uri': 'imageUrl повинна бути коректною URL',
  }),
  system: Joi.string().trim().valid(...GAME_SYSTEM_VALUES).empty('').optional().messages({
    'any.only': 'Невірна ігрова система',
  }),
  visibility: Joi.string().trim().valid('PUBLIC', 'LINK_ONLY').required().messages({
    'any.only': 'Невірна видимість',
  }),
});

const campaignIdParamsSchema = Joi.object({
  campaignId: Joi.number().integer().min(1).required().messages({
    'number.base': 'campaignId повинен бути позитивним числом',
    'number.min': 'campaignId повинен бути позитивним числом',
  }),
});

const updateCampaignBodySchema = Joi.object({
  title: Joi.string().trim().min(3).max(100).optional().messages({
    'string.min': 'Назва повинна містити від 3 до 100 символів',
    'string.max': 'Назва повинна містити від 3 до 100 символів',
  }),
  description: Joi.string().trim().max(1000).optional().messages({
    'string.max': 'Опис не повинен перевищувати 1000 символів',
  }),
  imageUrl: Joi.string().trim().uri().optional().messages({
    'string.uri': 'imageUrl повинна бути коректною URL',
  }),
  system: Joi.string().trim().valid(...GAME_SYSTEM_VALUES).empty('').optional().messages({
    'any.only': 'Невірна ігрова система',
  }),
  visibility: Joi.string().trim().valid('PUBLIC', 'LINK_ONLY').optional().messages({
    'any.only': 'Невірна видимість',
  }),
  status: Joi.string().trim().valid('ACTIVE', 'FINISHED').optional().messages({
    'any.only': 'Невірний статус кампанії',
  }),
});

const transferCampaignOwnershipBodySchema = Joi.object({
  newOwnerId: Joi.number().integer().min(1).required().messages({
    'number.base': 'newOwnerId повинен бути позитивним числом',
    'number.min': 'newOwnerId повинен бути позитивним числом',
  }),
});

const addMemberBodySchema = Joi.object({
  newMemberId: Joi.number().integer().min(1).required().messages({
    'number.base': 'newMemberId повинен бути позитивним числом',
    'number.min': 'newMemberId повинен бути позитивним числом',
  }),
  role: Joi.string().trim().valid('GM', 'PLAYER').optional().messages({
    'any.only': 'Невірна роль',
  }),
});

const removeMemberParamsSchema = Joi.object({
  campaignId: Joi.number().integer().min(1).required().messages({
    'number.base': 'campaignId повинен бути позитивним числом',
    'number.min': 'campaignId повинен бути позитивним числом',
  }),
  memberId: Joi.number().integer().min(1).required().messages({
    'number.base': 'memberId повинен бути позитивним числом',
    'number.min': 'memberId повинен бути позитивним числом',
  }),
});

const updateMemberRoleBodySchema = Joi.object({
  role: Joi.string().trim().valid('GM', 'PLAYER').required().messages({
    'any.only': 'Невірна роль',
  }),
});

const joinRequestBodySchema = Joi.object({
  message: Joi.string().trim().allow('').max(500).optional().messages({
    'string.max': 'Повідомлення не повинно перевищувати 500 символів',
  }),
  shareToken: Joi.string().trim().min(10).max(255).optional().messages({
    'string.min': 'shareToken повинен містити від 10 до 255 символів',
    'string.max': 'shareToken повинен містити від 10 до 255 символів',
  }),
});

const requestIdParamsSchema = Joi.object({
  requestId: Joi.number().integer().min(1).required().messages({
    'number.base': 'requestId повинен бути позитивним числом',
    'number.min': 'requestId повинен бути позитивним числом',
  }),
});

const approveJoinRequestBodySchema = Joi.object({
  role: Joi.string().trim().valid('GM', 'PLAYER').optional().messages({
    'any.only': 'Невірна роль',
  }),
});

const getMyCampaignsQuerySchema = Joi.object({
  role: Joi.string().trim().valid('all', 'owner', 'member').optional().messages({
    'any.only': 'Невірна роль для фільтру',
  }),
});

const shareTokenParamsSchema = Joi.object({
  shareToken: Joi.string().trim().min(10).max(255).required().messages({
    'string.empty': 'shareToken обов\'язковий',
    'string.min': 'shareToken повинен містити від 10 до 255 символів',
    'string.max': 'shareToken повинен містити від 10 до 255 символів',
    'any.required': 'shareToken обов\'язковий',
  }),
});

const validateCreateCampaign = [validateBody(createCampaignBodySchema)];
const validateUpdateCampaign = [validateParams(campaignIdParamsSchema), validateBody(updateCampaignBodySchema)];
const validateCampaignId = [validateParams(campaignIdParamsSchema)];
const validateTransferCampaignOwnership = [
  validateParams(campaignIdParamsSchema),
  validateBody(transferCampaignOwnershipBodySchema),
];
const validateAddMember = [validateParams(campaignIdParamsSchema), validateBody(addMemberBodySchema)];
const validateRemoveMember = [validateParams(removeMemberParamsSchema)];
const validateUpdateMemberRole = [validateParams(removeMemberParamsSchema), validateBody(updateMemberRoleBodySchema)];
const validateJoinRequest = [validateParams(campaignIdParamsSchema), validateBody(joinRequestBodySchema)];
const validateApproveJoinRequest = [validateParams(requestIdParamsSchema), validateBody(approveJoinRequestBodySchema)];
const validateRejectJoinRequest = [validateParams(requestIdParamsSchema)];
const validateGetMyCampaigns = [validateQuery(getMyCampaignsQuerySchema)];
const validateShareToken = [validateParams(shareTokenParamsSchema)];

module.exports = {
  validateCreateCampaign,
  validateUpdateCampaign,
  validateCampaignId,
  validateTransferCampaignOwnership,
  validateAddMember,
  validateRemoveMember,
  validateUpdateMemberRole,
  validateJoinRequest,
  validateApproveJoinRequest,
  validateRejectJoinRequest,
  validateGetMyCampaigns,
  validateShareToken,
};
