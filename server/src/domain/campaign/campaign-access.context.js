const {
  RESOURCE_TYPES,
  getViewerType,
} = require('../access/access-rules');

function resolveCampaignMembershipRole(campaign, userId) {
  if (!campaign || !userId) return null;

  if (campaign.ownerId === userId) {
    return 'OWNER';
  }

  const member = Array.isArray(campaign.members)
    ? campaign.members.find((entry) => entry.userId === userId)
    : null;

  return member?.role || null;
}

function buildCampaignAccessContext({
  campaign,
  userId = null,
  hasValidShareToken = false,
  role = null,
  isPendingJoinRequester = false,
} = {}) {
  const resolvedRole = role || resolveCampaignMembershipRole(campaign, userId);
  const isOwner = Boolean(userId && campaign?.ownerId === userId);
  const isMember = Boolean(resolvedRole && resolvedRole !== 'OWNER');
  const isCampaignMember = Boolean(isOwner || isMember);

  const context = {
    resourceType: RESOURCE_TYPES.CAMPAIGN,
    resourceId: campaign?.id || null,
    userId,
    visibility: campaign?.visibility || null,
    status: campaign?.status || null,
    hasValidShareToken: Boolean(hasValidShareToken),
    isOwner,
    isMember,
    isCampaignMember,
    isPendingJoinRequester: Boolean(isPendingJoinRequester),
    role: resolvedRole,
  };

  return {
    ...context,
    viewerType: getViewerType(context),
  };
}

module.exports = {
  buildCampaignAccessContext,
  resolveCampaignMembershipRole,
};
