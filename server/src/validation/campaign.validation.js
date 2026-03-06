const { body, param, query, validationResult } = require('express-validator');
const { AppError, ERROR_CODES } = require('../constants/errors');

// Middleware для перевірки помилок валідації
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg).join(', ');
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, errorMessages);
  }
  next();
};

// === Валідація для кампаній ===

const validateCreateCampaign = [
  body('title')
    .trim()
    .notEmpty().withMessage('Назва кампанії обов\'язкова')
    .isLength({ min: 3, max: 100 }).withMessage('Назва повинна містити від 3 до 100 символів'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Опис не повинен перевищувати 1000 символів'),
  
  body('imageUrl')
    .optional()
    .trim()
    .isURL().withMessage('imageUrl повинна бути коректною URL'),
  
  body('system')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('System не повинна перевищувати 50 символів'),
  
  body('visibility')
    .trim()
    .isIn(['PUBLIC', 'PRIVATE', 'LINK_ONLY']).withMessage('Невірна видимість'),
  
  handleValidationErrors,
];

const validateUpdateCampaign = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Назва повинна містити від 3 до 100 символів'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }).withMessage('Опис не повинен перевищувати 1000 символів'),
  
  body('imageUrl')
    .optional()
    .trim()
    .isURL().withMessage('imageUrl повинна бути коректною URL'),
  
  body('system')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('System не повинна перевищувати 50 символів'),
  
  body('visibility')
    .optional()
    .trim()
    .isIn(['PUBLIC', 'PRIVATE', 'LINK_ONLY']).withMessage('Невірна видимість'),
  
  handleValidationErrors,
];

const validateCampaignId = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),
  
  handleValidationErrors,
];

const validateTransferCampaignOwnership = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),

  body('newOwnerId')
    .isInt({ min: 1 }).withMessage('newOwnerId повинен бути позитивним числом'),

  handleValidationErrors,
];

const validateAddMember = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),
  
  body('newMemberId')
    .isInt({ min: 1 }).withMessage('newMemberId повинен бути позитивним числом'),
  
  body('role')
    .optional()
    .trim()
    .isIn(['GM', 'PLAYER']).withMessage('Невірна роль'),
  
  handleValidationErrors,
];

const validateRemoveMember = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),
  
  param('memberId')
    .isInt({ min: 1 }).withMessage('memberId повинен бути позитивним числом'),
  
  handleValidationErrors,
];

const validateUpdateMemberRole = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),
  
  param('memberId')
    .isInt({ min: 1 }).withMessage('memberId повинен бути позитивним числом'),
  
  body('role')
    .trim()
    .isIn(['GM', 'PLAYER']).withMessage('Невірна роль'),
  
  handleValidationErrors,
];

const validateJoinRequest = [
  param('campaignId')
    .isInt({ min: 1 }).withMessage('campaignId повинен бути позитивним числом'),
  
  body('message')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Повідомлення не повинно перевищувати 500 символів'),
  
  handleValidationErrors,
];

const validateApproveJoinRequest = [
  param('requestId')
    .isInt({ min: 1 }).withMessage('requestId повинен бути позитивним числом'),
  
  body('role')
    .optional()
    .trim()
    .isIn(['GM', 'PLAYER']).withMessage('Невірна роль'),
  
  handleValidationErrors,
];

const validateRejectJoinRequest = [
  param('requestId')
    .isInt({ min: 1 }).withMessage('requestId повинен бути позитивним числом'),
  
  handleValidationErrors,
];

const validateGetMyCampaigns = [
  query('role')
    .optional()
    .trim()
    .isIn(['all', 'owner', 'member']).withMessage('Невірна роль для фільтру'),
  
  handleValidationErrors,
];

const validateInviteCode = [
  param('inviteCode')
    .trim()
    .notEmpty().withMessage('inviteCode обов\'язковий')
    .isLength({ min: 3, max: 20 }).withMessage('inviteCode повинен містити від 3 до 20 символів'),
  
  handleValidationErrors,
];

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
