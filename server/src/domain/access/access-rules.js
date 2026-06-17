const RESOURCE_TYPES = Object.freeze({
  CAMPAIGN: 'CAMPAIGN',
  SESSION: 'SESSION',
});

const SESSION_KINDS = Object.freeze({
  ONE_SHOT: 'ONE_SHOT',
  CAMPAIGN_SESSION: 'CAMPAIGN_SESSION',
});

const ACCESS_VISIBILITY = Object.freeze({
  PUBLIC: 'PUBLIC',
  PRIVATE: 'PRIVATE',
  LINK_ONLY: 'LINK_ONLY',
});

const VIEWER_TYPES = Object.freeze({
  ANONYMOUS: 'ANONYMOUS',
  AUTHENTICATED_OUTSIDER: 'AUTHENTICATED_OUTSIDER',
  OWNER: 'OWNER',
  CAMPAIGN_MEMBER: 'CAMPAIGN_MEMBER',
  SESSION_PARTICIPANT: 'SESSION_PARTICIPANT',
});

const JOIN_MODES = Object.freeze({
  OPEN: 'OPEN',
  REQUEST: 'REQUEST',
  MEMBERS_ONLY: 'MEMBERS_ONLY',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
});

const CAMPAIGN_ACCESS_RULES = Object.freeze({
  [ACCESS_VISIBILITY.PUBLIC]: Object.freeze({
    outsiderDiscoverable: true,
    outsiderCanOpenDirectly: true,
    outsiderNeedsShareToken: false,
    joinMode: JOIN_MODES.REQUEST,
  }),
  [ACCESS_VISIBILITY.LINK_ONLY]: Object.freeze({
    outsiderDiscoverable: false,
    outsiderCanOpenDirectly: false,
    outsiderNeedsShareToken: true,
    joinMode: JOIN_MODES.REQUEST,
  }),
});

const SESSION_ACCESS_RULES = Object.freeze({
  [SESSION_KINDS.ONE_SHOT]: Object.freeze({
    [ACCESS_VISIBILITY.PUBLIC]: Object.freeze({
      outsiderDiscoverable: true,
      outsiderCanOpenDirectly: true,
      outsiderNeedsShareToken: false,
      joinMode: JOIN_MODES.OPEN,
    }),
    [ACCESS_VISIBILITY.PRIVATE]: Object.freeze({
      outsiderDiscoverable: true,
      outsiderCanOpenDirectly: true,
      outsiderNeedsShareToken: false,
      joinMode: JOIN_MODES.REQUEST,
    }),
    [ACCESS_VISIBILITY.LINK_ONLY]: Object.freeze({
      outsiderDiscoverable: false,
      outsiderCanOpenDirectly: false,
      outsiderNeedsShareToken: true,
      joinMode: JOIN_MODES.REQUEST,
    }),
  }),
  [SESSION_KINDS.CAMPAIGN_SESSION]: Object.freeze({
    [ACCESS_VISIBILITY.PUBLIC]: Object.freeze({
      outsiderDiscoverable: true,
      outsiderCanOpenDirectly: true,
      outsiderNeedsShareToken: false,
      joinMode: JOIN_MODES.REQUEST,
    }),
    [ACCESS_VISIBILITY.PRIVATE]: Object.freeze({
      outsiderDiscoverable: false,
      outsiderCanOpenDirectly: false,
      outsiderNeedsShareToken: false,
      joinMode: JOIN_MODES.MEMBERS_ONLY,
    }),
  }),
});

function getViewerType(context = {}) {
  if (context.isOwner) return VIEWER_TYPES.OWNER;
  if (context.isParticipant) return VIEWER_TYPES.SESSION_PARTICIPANT;
  if (context.isMember || context.isCampaignMember) return VIEWER_TYPES.CAMPAIGN_MEMBER;
  if (context.userId) return VIEWER_TYPES.AUTHENTICATED_OUTSIDER;
  return VIEWER_TYPES.ANONYMOUS;
}

function isEntitledCampaignViewer(context = {}) {
  return Boolean(context.isOwner || context.isMember || context.isCampaignMember);
}

function isEntitledSessionViewer(context = {}) {
  return Boolean(context.isOwner || context.isParticipant || context.isCampaignMember);
}

function isOutsider(context = {}) {
  return !isEntitledCampaignViewer(context) && !isEntitledSessionViewer(context);
}

function getCampaignRule(visibility) {
  return CAMPAIGN_ACCESS_RULES[visibility] || null;
}

function getSessionRule({ visibility, isCampaignSession }) {
  const kind = isCampaignSession ? SESSION_KINDS.CAMPAIGN_SESSION : SESSION_KINDS.ONE_SHOT;
  return SESSION_ACCESS_RULES[kind]?.[visibility] || null;
}

function canDiscoverCampaign(context = {}) {
  const rule = getCampaignRule(context.visibility);

  if (!rule) return false;
  if (isEntitledCampaignViewer(context)) return true;

  return rule.outsiderDiscoverable;
}

function canOpenCampaign(context = {}) {
  const rule = getCampaignRule(context.visibility);

  if (!rule) return false;
  if (isEntitledCampaignViewer(context)) return true;
  if (context.isPendingJoinRequester) return true;
  if (rule.outsiderCanOpenDirectly) return true;
  if (rule.outsiderNeedsShareToken) {
    return Boolean(context.userId && context.hasValidShareToken);
  };

  return false;
}

function campaignRequiresShareTokenForOutsider(context = {}) {
  const rule = getCampaignRule(context.visibility);
  return Boolean(rule?.outsiderNeedsShareToken);
}

function getCampaignJoinMode(context = {}) {
  const rule = getCampaignRule(context.visibility);
  return rule ? rule.joinMode : JOIN_MODES.NOT_APPLICABLE;
}

function canManageCampaign(context = {}) {
  return Boolean(context.isOwner);
}

function canDiscoverSession(context = {}) {
  if (!context) return false;
  const rule = getSessionRule({
    visibility: context.visibility,
    isCampaignSession: Boolean(context.isCampaignSession),
  });

  if (!rule) return false;
  if (isEntitledSessionViewer(context)) return true;

  return rule.outsiderDiscoverable;
}

function canOpenSession(context = {}) {
  if (!context) return false;
  const rule = getSessionRule({
    visibility: context.visibility,
    isCampaignSession: Boolean(context.isCampaignSession),
  });

  if (!rule) return false;
  if (isEntitledSessionViewer(context)) return true;
  if (context.isPendingParticipant) return true;
  if (context.isCampaignSession && context.hasValidCampaignShareToken) return true;
  if (rule.outsiderCanOpenDirectly) return true;
  if (rule.outsiderNeedsShareToken) {
    return Boolean(context.userId && context.hasValidShareToken);
  }

  return false;
}

function sessionRequiresShareTokenForOutsider(context = {}) {
  if (!context) return false;
  const rule = getSessionRule({
    visibility: context.visibility,
    isCampaignSession: Boolean(context.isCampaignSession),
  });

  return Boolean(rule?.outsiderNeedsShareToken);
}

function getSessionJoinMode(context = {}) {
  if (!context) return JOIN_MODES.NOT_APPLICABLE;
  const rule = getSessionRule({
    visibility: context.visibility,
    isCampaignSession: Boolean(context.isCampaignSession),
  });

  return rule ? rule.joinMode : JOIN_MODES.NOT_APPLICABLE;
}

function canManageSession(context = {}) {
  if (!context) return false;
  return Boolean(context.isOwner || context.isConfirmedGm);
}

function canManageSessionParticipants(context = {}) {
  if (!context) return false;
  return Boolean(context.isOwner || context.isConfirmedGm);
}

module.exports = {
  ACCESS_VISIBILITY,
  CAMPAIGN_ACCESS_RULES,
  JOIN_MODES,
  RESOURCE_TYPES,
  SESSION_ACCESS_RULES,
  SESSION_KINDS,
  VIEWER_TYPES,
  canDiscoverCampaign,
  canDiscoverSession,
  canManageCampaign,
  canManageSession,
  canManageSessionParticipants,
  canOpenCampaign,
  canOpenSession,
  campaignRequiresShareTokenForOutsider,
  getCampaignJoinMode,
  getCampaignRule,
  getSessionJoinMode,
  getSessionRule,
  getViewerType,
  isOutsider,
  sessionRequiresShareTokenForOutsider,
};
