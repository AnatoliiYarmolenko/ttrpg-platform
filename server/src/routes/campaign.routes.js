const express = require('express');

const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const { shareTokenLimiter } = require('../middlewares/rate-limit.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const campaignController = require('../controllers/campaign.controller');
const sessionCrudController = require('../controllers/session/session-crud.controller');

const {
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
} = require('../validation/campaign.validation');

const { validateGetCampaignSessions } = require('../validation/session.validation');

router.get(
  '/share/:shareToken',
  [shareTokenLimiter, optionalAuthenticateToken, ...validateShareToken],
  (req, res, next) => campaignController.getCampaignByShareToken(req, res, next)
);

router.get(
  '/share/:shareToken/page',
  [shareTokenLimiter, optionalAuthenticateToken, ...validateShareToken],
  (req, res, next) => campaignController.getCampaignPageByShareToken(req, res, next)
);

router.post(
  '/',
  [authenticateToken, verifyCSRFToken, ...validateCreateCampaign],
  (req, res, next) => campaignController.createCampaign(req, res, next)
);

router.get(
  '/',
  [authenticateToken, ...validateGetMyCampaigns],
  (req, res, next) => campaignController.getMyCampaigns(req, res, next)
);

router.get(
  '/:campaignId',
  [authenticateToken, ...validateCampaignId],
  (req, res, next) => campaignController.getCampaignById(req, res, next)
);

router.get(
  '/:campaignId/page',
  [authenticateToken, ...validateCampaignId],
  (req, res, next) => campaignController.getCampaignPageById(req, res, next)
);

router.patch(
  '/:campaignId',
  [authenticateToken, verifyCSRFToken, ...validateUpdateCampaign],
  (req, res, next) => campaignController.updateCampaign(req, res, next)
);

router.post(
  '/:campaignId/transfer-ownership',
  [authenticateToken, verifyCSRFToken, ...validateTransferCampaignOwnership],
  (req, res, next) => campaignController.transferCampaignOwnership(req, res, next)
);

router.get(
  '/:campaignId/members',
  [authenticateToken, ...validateCampaignId],
  (req, res, next) => campaignController.getCampaignMembers(req, res, next)
);

router.delete(
  '/:campaignId/members/:memberId',
  [authenticateToken, verifyCSRFToken, ...validateRemoveMember],
  (req, res, next) => campaignController.removeMemberFromCampaign(req, res, next)
);

router.patch(
  '/:campaignId/members/:memberId',
  [authenticateToken, verifyCSRFToken, ...validateUpdateMemberRole],
  (req, res, next) => campaignController.updateMemberRole(req, res, next)
);

router.get(
  '/:campaignId/sessions',
  [authenticateToken, ...validateGetCampaignSessions],
  (req, res, next) => sessionCrudController.getCampaignSessions(req, res, next)
);

router.post(
  '/:campaignId/share/regenerate',
  [authenticateToken, verifyCSRFToken, ...validateCampaignId],
  (req, res, next) => campaignController.regenerateShareToken(req, res, next)
);

router.get(
  '/:campaignId/share-link',
  [authenticateToken, ...validateCampaignId],
  (req, res, next) => campaignController.getCampaignShareLink(req, res, next)
);

router.post(
  '/:campaignId/requests',
  [authenticateToken, verifyCSRFToken, ...validateJoinRequest],
  (req, res, next) => campaignController.submitJoinRequest(req, res, next)
);

router.post(
  '/:campaignId/requests/cancel',
  [authenticateToken, verifyCSRFToken, ...validateCampaignId],
  (req, res, next) => campaignController.cancelJoinRequest(req, res, next)
);

router.get(
  '/:campaignId/requests',
  [authenticateToken, ...validateCampaignId],
  (req, res, next) => campaignController.getJoinRequests(req, res, next)
);

router.post(
  '/requests/:requestId/approve',
  [authenticateToken, verifyCSRFToken, ...validateApproveJoinRequest],
  (req, res, next) => campaignController.approveJoinRequest(req, res, next)
);

router.post(
  '/requests/:requestId/reject',
  [authenticateToken, verifyCSRFToken, ...validateRejectJoinRequest],
  (req, res, next) => campaignController.rejectJoinRequest(req, res, next)
);

module.exports = router;
