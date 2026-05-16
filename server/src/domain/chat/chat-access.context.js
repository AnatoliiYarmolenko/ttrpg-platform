const CHAT_SCOPES = Object.freeze({
  CAMPAIGN: 'CAMPAIGN',
  SESSION: 'SESSION',
});

function resolveCampaignMembership(campaign, userId) {
  if (!campaign || !userId || !Array.isArray(campaign.members)) {
    return null;
  }

  return campaign.members.find((member) => member.userId === userId) || null;
}

function resolveConfirmedParticipation(session, userId) {
  if (!session || !userId || !Array.isArray(session.participants)) {
    return null;
  }

  const participant = session.participants.find((entry) => entry.userId === userId) || null;
  return participant?.status === 'CONFIRMED' ? participant : null;
}

function resolvePendingParticipation(session, userId) {
  if (!session || !userId || !Array.isArray(session.participants)) {
    return null;
  }

  const participant = session.participants.find((entry) => entry.userId === userId) || null;
  return participant?.status === 'PENDING' ? participant : null;
}

function resolveChatScope(chat) {
  if (chat?.campaignId) {
    return CHAT_SCOPES.CAMPAIGN;
  }

  if (chat?.sessionId) {
    return CHAT_SCOPES.SESSION;
  }

  return null;
}

function isReadonlyByStatus({ campaignStatus, sessionStatus } = {}) {
  if (campaignStatus === 'FINISHED') {
    return true;
  }

  return sessionStatus === 'FINISHED' || sessionStatus === 'CANCELED';
}

function buildChatAccessContext({ chat, userId = null } = {}) {
  const scope = resolveChatScope(chat);
  const campaign = chat?.campaign || null;
  const session = chat?.session || null;

  const campaignMembership = resolveCampaignMembership(campaign, userId);
  const confirmedParticipation = resolveConfirmedParticipation(session, userId);
  const pendingParticipation = resolvePendingParticipation(session, userId);

  const isCampaignOwner = Boolean(userId && campaign?.ownerId === userId);
  const isCampaignMember = Boolean(campaignMembership);
  const isSessionParticipant = Boolean(confirmedParticipation);
  const isPendingParticipant = Boolean(pendingParticipation);
  const isCampaignOwnerOverride = Boolean(userId && session?.campaign?.ownerId === userId);

  const readonly = isReadonlyByStatus({
    campaignStatus: campaign?.status || session?.campaign?.status || null,
    sessionStatus: session?.status || null,
  });

  return {
    chatId: chat?.id || null,
    scope,
    userId,
    campaignId: chat?.campaignId || null,
    sessionId: chat?.sessionId || null,
    campaignStatus: campaign?.status || session?.campaign?.status || null,
    sessionStatus: session?.status || null,
    isCampaignOwner,
    isCampaignMember,
    isSessionParticipant,
    isPendingParticipant,
    isCampaignOwnerOverride,
    readonly,
  };
}

module.exports = {
  CHAT_SCOPES,
  buildChatAccessContext,
  resolveChatScope,
  resolveCampaignMembership,
  resolveConfirmedParticipation,
  resolvePendingParticipation,
  isReadonlyByStatus,
};
