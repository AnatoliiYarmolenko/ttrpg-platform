const {
  canDiscoverSession,
  canOpenSession,
  canManageSession,
  canManageSessionParticipants,
  getSessionJoinMode,
  sessionRequiresShareTokenForOutsider,
} = require('../access/access-rules');

function getSessionViewerCapabilities(context = {}) {
  return {
    canDiscover: canDiscoverSession(context),
    canOpen: canOpenSession(context),
    canManage: canManageSession(context),
    canManageParticipants: canManageSessionParticipants(context),
    joinMode: getSessionJoinMode(context),
    requiresShareTokenForOutsider: sessionRequiresShareTokenForOutsider(context),
  };
}

module.exports = {
  canDiscoverSession,
  canOpenSession,
  canManageSession,
  canManageSessionParticipants,
  getSessionJoinMode,
  sessionRequiresShareTokenForOutsider,
  getSessionViewerCapabilities,
};
