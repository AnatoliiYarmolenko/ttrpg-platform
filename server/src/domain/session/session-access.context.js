const {
  RESOURCE_TYPES,
  getViewerType,
} = require('../access/access-rules');

function resolveSessionParticipation(session, userId) {
  if (!session || !userId || !Array.isArray(session.participants)) {
    return null;
  }

  const participant = session.participants.find((p) => p.userId === userId) || null;
  return participant?.status === 'CONFIRMED' ? participant : null;
}

function resolvePendingParticipation(session, userId) {
  if (!session || !userId || !Array.isArray(session.participants)) {
    return null;
  }

  const participant = session.participants.find((p) => p.userId === userId) || null;
  return participant?.status === 'PENDING' ? participant : null;
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
  hasValidCampaignShareToken = false,
  isCampaignMember = null,
  isConfirmedGm = null,
} = {}) {
  const participation = resolveSessionParticipation(session, userId);
  const pendingParticipation = resolvePendingParticipation(session, userId);
  const campaignMembership = resolveCampaignMembership(session, userId);
  const isOwner = Boolean(userId && session?.ownerId === userId);
  const isParticipant = Boolean(participation);
  const isPendingParticipant = Boolean(pendingParticipation);
  const resolvedCampaignMembership = isCampaignMember === null
    ? Boolean(campaignMembership || (userId && session?.campaign?.ownerId === userId))
    : Boolean(isCampaignMember);

  const resolvedConfirmedGm = isConfirmedGm === null
    ? Boolean(participation?.role === 'GM')
    : Boolean(isConfirmedGm);

  const resolvedParticipation = participation || pendingParticipation;

  const context = {
    resourceType: RESOURCE_TYPES.SESSION,
    resourceId: session?.id || null,
    userId,
    visibility: session?.visibility || null,
    status: session?.status || null,
    hasValidShareToken: Boolean(hasValidShareToken),
    hasValidCampaignShareToken: Boolean(hasValidCampaignShareToken),
    isOwner,
    isParticipant,
    isPendingParticipant,
    isCampaignMember: resolvedCampaignMembership,
    isCampaignSession: Boolean(session?.campaignId),
    isConfirmedGm: resolvedConfirmedGm,
    role: resolvedParticipation?.role || null,
    participationStatus: resolvedParticipation?.status || null,
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
  resolvePendingParticipation,
};
