/**
 * Notification constants
 * MVP-01: Centralized notification keys and statuses
 */

const NotificationSeverity = Object.freeze({
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
  SECURITY: 'SECURITY',
});

const RecipientStatus = Object.freeze({
  UNREAD: 'UNREAD',
  READ: 'READ',
  ARCHIVED: 'ARCHIVED',
});

const NotificationType = Object.freeze({
  // Session notifications (MVP scope)
  SESSION_JOIN_REQUESTS_UPDATED: 'SESSION_JOIN_REQUESTS_UPDATED',
  SESSION_PARTICIPATION_CONFIRMED: 'SESSION_PARTICIPATION_CONFIRMED',
  SESSION_RESCHEDULED: 'SESSION_RESCHEDULED',
  SESSION_CONFLICT_REVIEW_REQUIRED: 'SESSION_CONFLICT_REVIEW_REQUIRED',
  SESSION_OWNER_CONFLICT_SUMMARY: 'SESSION_OWNER_CONFLICT_SUMMARY',
  SESSION_CANCELLED: 'SESSION_CANCELLED',

  // Campaign notifications (MVP scope)
  CAMPAIGN_JOIN_REQUESTS_UPDATED: 'CAMPAIGN_JOIN_REQUESTS_UPDATED',
  CAMPAIGN_PARTICIPATION_CONFIRMED: 'CAMPAIGN_PARTICIPATION_CONFIRMED',
  CAMPAIGN_PARTICIPATION_DECLINED: 'CAMPAIGN_PARTICIPATION_DECLINED',
  CAMPAIGN_MEMBER_REMOVED: 'CAMPAIGN_MEMBER_REMOVED',
});

const NotificationCategory = Object.freeze({
  SESSION: 'session',
  CAMPAIGN: 'campaign',
  SECURITY: 'security',
  SYSTEM: 'system',
});

module.exports = {
  NotificationSeverity,
  RecipientStatus,
  NotificationType,
  NotificationCategory,
};
