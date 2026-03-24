const {
  RESOURCE_TYPES,
  getViewerType,
} = require('../access/access-rules');

function resolveSessionParticipation(session, userId) {
  if (!session || !userId || !Array.isArray(session.participants)) {
    return null;
  }

  return session.participants.find((participant) => participant.userId === userId) || null;
}

function resolveCampaignMembership(session, userId) {
  if (!session?.campaign || !userId || !Array.isArray(session.campaign.members)) {
    return null;
  }

  return session.campaign.members.find((member) => member.userId === userId) || null;
}

function buildSessionAccessContext({
  session,
  userId = null,
  hasValidShareToken = false,
  isCampaignMember = null,
  isConfirmedGm = null,
} = {}) {
  const participation = resolveSessionParticipation(session, userId);
  const campaignMembership = resolveCampaignMembership(session, userId);
  const isOwner = Boolean(userId && session?.ownerId === userId);
  const isParticipant = Boolean(participation);
  const resolvedCampaignMembership = isCampaignMember !== null
    ? Boolean(isCampaignMember)
    : Boolean(campaignMembership || (userId && session?.campaign?.ownerId === userId));
  const resolvedConfirmedGm = isConfirmedGm !== null
    ? Boolean(isConfirmedGm)
    : Boolean(
      participation
      && participation.role === 'GM'
      && participation.status === 'CONFIRMED'
    );

  const context = {
    resourceType: RESOURCE_TYPES.SESSION,
    resourceId: session?.id || null,
    userId,
    visibility: session?.visibility || null,
    status: session?.status || null,
    hasValidShareToken: Boolean(hasValidShareToken),
    isOwner,
    isParticipant,
    isCampaignMember: resolvedCampaignMembership,
    isCampaignSession: Boolean(session?.campaignId),
    isConfirmedGm: resolvedConfirmedGm,
    role: participation?.role || null,
    participationStatus: participation?.status || null,
  };

  return {
    ...context,
    viewerType: getViewerType(context),
  };
}

module.exports = {
  buildSessionAccessContext,
  resolveCampaignMembership,
  resolveSessionParticipation,
};
