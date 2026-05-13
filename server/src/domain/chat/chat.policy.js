const { CHAT_SCOPES } = require('./chat-access.context');

function isAuthenticated(context = {}) {
  return Boolean(context.userId);
}

function canReadChat(context = {}) {
  if (!isAuthenticated(context)) {
    return false;
  }

  if (context.scope === CHAT_SCOPES.CAMPAIGN) {
    return Boolean(context.isCampaignOwner || context.isCampaignMember);
  }

  if (context.scope === CHAT_SCOPES.SESSION) {
    return Boolean(context.isSessionParticipant || context.isCampaignOwnerOverride);
  }

  return false;
}

function canWriteChat(context = {}) {
  if (!canReadChat(context)) {
    return false;
  }

  return !context.readonly;
}

function canModerateChat(_context = {}) {
  return false;
}

function getChatCapabilities(context = {}) {
  return {
    canRead: canReadChat(context),
    canWrite: canWriteChat(context),
    canModerate: canModerateChat(context),
    readonly: Boolean(context.readonly),
  };
}

module.exports = {
  canReadChat,
  canWriteChat,
  canModerateChat,
  getChatCapabilities,
};
