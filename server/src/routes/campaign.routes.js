const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth.middleware');
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
  validateInviteCode,
} = require('../validation/campaign.validation');

const { validateGetCampaignSessions } = require('../validation/session.validation');

// === Публічні маршути ===

// POST /api/campaigns/invite/:inviteCode
router.post('/invite/:inviteCode', [authenticateToken, verifyCSRFToken, ...validateInviteCode], (req, res, next) => campaignController.joinByInviteCode(req, res, next));

// === Захищені маршути ===

// POST /api/campaigns
router.post('/', [authenticateToken, verifyCSRFToken, ...validateCreateCampaign], (req, res, next) => campaignController.createCampaign(req, res, next));

// GET /api/campaigns
router.get('/', [authenticateToken, ...validateGetMyCampaigns], (req, res, next) => campaignController.getMyCampaigns(req, res, next));

// GET /api/campaigns/:campaignId
router.get('/:campaignId', [authenticateToken, ...validateCampaignId], (req, res, next) => campaignController.getCampaignById(req, res, next));

// PUT /api/campaigns/:campaignId
router.put('/:campaignId', [authenticateToken, verifyCSRFToken, ...validateUpdateCampaign], (req, res, next) => campaignController.updateCampaign(req, res, next));

// POST /api/campaigns/:campaignId/transfer-ownership
router.post(
  '/:campaignId/transfer-ownership',
  [authenticateToken, verifyCSRFToken, ...validateTransferCampaignOwnership],
  (req, res, next) => campaignController.transferCampaignOwnership(req, res, next)
);

// === Члени кампанії ===

router.get('/:campaignId/members', [authenticateToken, ...validateCampaignId], (req, res, next) => campaignController.getCampaignMembers(req, res, next));

router.post('/:campaignId/members', [authenticateToken, verifyCSRFToken, ...validateAddMember], (req, res, next) => campaignController.addMemberToCampaign(req, res, next));

router.delete('/:campaignId/members/:memberId', [authenticateToken, verifyCSRFToken, ...validateRemoveMember], (req, res, next) => campaignController.removeMemberFromCampaign(req, res, next));

router.patch('/:campaignId/members/:memberId', [authenticateToken, verifyCSRFToken, ...validateUpdateMemberRole], (req, res, next) => campaignController.updateMemberRole(req, res, next));

// === Сесії кампанії (Sub-resource) ===

// GET /api/campaigns/:campaignId/sessions
// Маршрут тут, а контролер - sessionController
router.get(
  '/:campaignId/sessions', 
  [authenticateToken, ...validateGetCampaignSessions], 
  (req, res, next) => sessionCrudController.getCampaignSessions(req, res, next)
);

// === Коди запрошень ===

router.post('/:campaignId/invite', [authenticateToken, verifyCSRFToken, ...validateCampaignId], (req, res, next) => campaignController.regenerateInviteCode(req, res, next));

// === Запити на приєднання ===

router.post('/:campaignId/requests', [authenticateToken, verifyCSRFToken, ...validateJoinRequest], (req, res, next) => campaignController.submitJoinRequest(req, res, next));

router.get('/:campaignId/requests', [authenticateToken, ...validateCampaignId], (req, res, next) => campaignController.getJoinRequests(req, res, next));

router.post('/requests/:requestId/approve', [authenticateToken, verifyCSRFToken, ...validateApproveJoinRequest], (req, res, next) => campaignController.approveJoinRequest(req, res, next));

router.post('/requests/:requestId/reject', [authenticateToken, verifyCSRFToken, ...validateRejectJoinRequest], (req, res, next) => campaignController.rejectJoinRequest(req, res, next));

module.exports = router;