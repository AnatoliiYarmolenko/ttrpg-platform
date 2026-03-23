const Joi = require('joi');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validation.middleware');

// === Валідація для кампаній ===

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
  system: Joi.string().trim().max(50).optional().messages({
    'string.max': 'System не повинна перевищувати 50 символів',
  }),
  visibility: Joi.string().trim().valid('PUBLIC', 'PRIVATE', 'LINK_ONLY').required().messages({
    'any.only': 'Невірна видимість',
  }),
});

const validateCreateCampaign = [validateBody(createCampaignBodySchema)];

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
  system: Joi.string().trim().max(50).optional().messages({
    'string.max': 'System не повинна перевищувати 50 символів',
  }),
  visibility: Joi.string().trim().valid('PUBLIC', 'PRIVATE', 'LINK_ONLY').optional().messages({
    'any.only': 'Невірна видимість',
  }),
  status: Joi.string().trim().valid('ACTIVE', 'FINISHED').optional().messages({
    'any.only': 'Невірний статус кампанії',
  }),
});

const validateUpdateCampaign = [validateParams(campaignIdParamsSchema), validateBody(updateCampaignBodySchema)];

const validateCampaignId = [validateParams(campaignIdParamsSchema)];

const transferCampaignOwnershipBodySchema = Joi.object({
  newOwnerId: Joi.number().integer().min(1).required().messages({
    'number.base': 'newOwnerId повинен бути позитивним числом',
    'number.min': 'newOwnerId повинен бути позитивним числом',
  }),
});

const validateTransferCampaignOwnership = [
  validateParams(campaignIdParamsSchema),
  validateBody(transferCampaignOwnershipBodySchema),
];

const addMemberBodySchema = Joi.object({
  newMemberId: Joi.number().integer().min(1).required().messages({
    'number.base': 'newMemberId повинен бути позитивним числом',
    'number.min': 'newMemberId повинен бути позитивним числом',
  }),
  role: Joi.string().trim().valid('GM', 'PLAYER').optional().messages({
    'any.only': 'Невірна роль',
  }),
});

const validateAddMember = [validateParams(campaignIdParamsSchema), validateBody(addMemberBodySchema)];

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

const validateRemoveMember = [validateParams(removeMemberParamsSchema)];

const updateMemberRoleBodySchema = Joi.object({
  role: Joi.string().trim().valid('GM', 'PLAYER').required().messages({
    'any.only': 'Невірна роль',
  }),
});

const validateUpdateMemberRole = [validateParams(removeMemberParamsSchema), validateBody(updateMemberRoleBodySchema)];

const joinRequestBodySchema = Joi.object({
  message: Joi.string().trim().max(500).optional().messages({
    'string.max': 'Повідомлення не повинно перевищувати 500 символів',
  }),
});

const validateJoinRequest = [validateParams(campaignIdParamsSchema), validateBody(joinRequestBodySchema)];

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

const validateApproveJoinRequest = [validateParams(requestIdParamsSchema), validateBody(approveJoinRequestBodySchema)];

const validateRejectJoinRequest = [validateParams(requestIdParamsSchema)];

const getMyCampaignsQuerySchema = Joi.object({
  role: Joi.string().trim().valid('all', 'owner', 'member').optional().messages({
    'any.only': 'Невірна роль для фільтру',
  }),
});

const validateGetMyCampaigns = [validateQuery(getMyCampaignsQuerySchema)];

const inviteCodeParamsSchema = Joi.object({
  inviteCode: Joi.string().trim().min(3).max(20).required().messages({
    'string.empty': 'inviteCode обов\'язковий',
    'string.min': 'inviteCode повинен містити від 3 до 20 символів',
    'string.max': 'inviteCode повинен містити від 3 до 20 символів',
    'any.required': 'inviteCode обов\'язковий',
  }),
});

const validateInviteCode = [validateParams(inviteCodeParamsSchema)];

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
  validateInviteCode,
};
