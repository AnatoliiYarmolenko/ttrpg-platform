const express = require('express');

const router = express.Router();
const { authenticateToken, optionalAuthenticateToken } = require('../middlewares/auth.middleware');
const { verifyCSRFToken } = require('../middlewares/csrf.middleware');
const {
  loadSessionContext,
  requireConfirmedSessionGm,
  requireSessionOwnerOrGm,
  requireSessionOwnerOrGmOrCampaignOwner,
  requireSessionOwnerOrCampaignOwner,
} = require('../middlewares/session-access.middleware');
const sessionCrudController = require('../controllers/session/session-crud.controller');
const sessionCalendarController = require('../controllers/session/session-calendar.controller');
const sessionParticipantsController = require('../controllers/session/session-participants.controller');
const {
  validateCreateSession,
  validateUpdateSession,
  validateSessionId,
  validateSessionShareToken,
  validateGetMySessions,
  validateGetCalendar,
  validateGetCalendarStats,
  validateGetSessionsByDayFiltered,
  validateJoinSession,
  validateUpdateParticipantStatus,
  validateRemoveParticipant,
  validateGetSessionsByDay,
} = require('../validation/session.validation');

router.post(
  '/',
  [authenticateToken, verifyCSRFToken, ...validateCreateSession],
  (req, res, next) => sessionCrudController.createSession(req, res, next)
);

router.get(
  '/',
  [authenticateToken, ...validateGetMySessions],
  (req, res, next) => sessionCrudController.getMySessions(req, res, next)
);

router.get(
  '/next-relevant',
  [authenticateToken],
  (req, res, next) => sessionCrudController.getNextRelevantSession(req, res, next)
);

router.get(
  '/next-home-session',
  [authenticateToken],
  (req, res, next) => sessionCrudController.getNextRelevantSession(req, res, next)
);

router.get(
  '/next-home',
  [authenticateToken],
  (req, res, next) => sessionCrudController.getNextRelevantSession(req, res, next)
);

router.get(
  '/calendar',
  [optionalAuthenticateToken, ...validateGetCalendar],
  (req, res, next) => sessionCalendarController.getCalendar(req, res, next)
);

router.get(
  '/calendar-stats',
  [authenticateToken, ...validateGetCalendarStats],
  (req, res, next) => sessionCalendarController.getCalendarStats(req, res, next)
);

router.get(
  '/day/:date',
  [optionalAuthenticateToken, ...validateGetSessionsByDay],
  (req, res, next) => sessionCalendarController.getSessionsByDay(req, res, next)
);

router.get(
  '/day-filtered/:date',
  [authenticateToken, ...validateGetSessionsByDayFiltered],
  (req, res, next) => sessionCalendarController.getSessionsByDayFiltered(req, res, next)
);

router.get(
  '/share/:shareToken',
  [optionalAuthenticateToken, ...validateSessionShareToken],
  (req, res, next) => sessionCrudController.getSessionByShareToken(req, res, next)
);

router.get(
  '/share/:shareToken/page',
  [optionalAuthenticateToken, ...validateSessionShareToken],
  (req, res, next) => sessionCrudController.getSessionPageByShareToken(req, res, next)
);

router.get(
  '/:id',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionById(req, res, next)
);

router.get(
  '/:id/page',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionPageById(req, res, next)
);

router.post(
  '/:id/share/regenerate',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.regenerateShareToken(req, res, next)
);

router.get(
  '/:id/share-link',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionCrudController.getSessionShareLink(req, res, next)
);

router.patch(
  '/:id',
  [authenticateToken, verifyCSRFToken, ...validateUpdateSession, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionCrudController.updateSession(req, res, next)
);

router.delete(
  '/:id',
  [authenticateToken, verifyCSRFToken, ...validateSessionId, loadSessionContext, requireSessionOwnerOrCampaignOwner],
  (req, res, next) => sessionCrudController.deleteSession(req, res, next)
);

router.post(
  '/:id/cancel',
  [
    authenticateToken,
    verifyCSRFToken,
    ...validateSessionId,
    loadSessionContext,
    requireSessionOwnerOrGmOrCampaignOwner,
  ],
  (req, res, next) => sessionCrudController.cancelSession(req, res, next)
);

router.post(
  '/:id/mark-finished',
  [authenticateToken, verifyCSRFToken, ...validateSessionId, loadSessionContext, requireConfirmedSessionGm],
  (req, res, next) => sessionCrudController.markSessionAsFinished(req, res, next)
);

router.get(
  '/:id/participants',
  [authenticateToken, ...validateSessionId],
  (req, res, next) => sessionParticipantsController.getSessionParticipants(req, res, next)
);

router.post(
  '/:id/join',
  [authenticateToken, verifyCSRFToken, ...validateJoinSession],
  (req, res, next) => sessionParticipantsController.joinSession(req, res, next)
);

router.post(
  '/:id/leave',
  [authenticateToken, verifyCSRFToken, ...validateSessionId],
  (req, res, next) => sessionParticipantsController.leaveSession(req, res, next)
);

router.post(
  '/:id/kick-gm',
  [authenticateToken, verifyCSRFToken, ...validateSessionId, loadSessionContext, requireSessionOwnerOrCampaignOwner],
  (req, res, next) => sessionParticipantsController.kickGm(req, res, next)
);

router.patch(
  '/:id/participants/:participantId',
  [authenticateToken, verifyCSRFToken, ...validateUpdateParticipantStatus, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionParticipantsController.updateParticipantStatus(req, res, next)
);

router.delete(
  '/:id/participants/:participantId',
  [authenticateToken, verifyCSRFToken, ...validateRemoveParticipant, loadSessionContext, requireSessionOwnerOrGm],
  (req, res, next) => sessionParticipantsController.removeParticipant(req, res, next)
);

module.exports = router;
