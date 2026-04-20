const { filterCampaignSessionsForViewer } = require('../../domain/access/discovery.policy');

function createCampaignPageService({ getCampaignById, getCampaignByShareToken, getJoinRequests }) {
  const mapOwner = (owner) => {
    if (!owner) return null;

    return {
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
    };
  };

  const mapMember = (member) => ({
    id: member.id,
    userId: member.userId,
    role: member.role,
    user: member.user
      ? {
        id: member.user.id,
        username: member.user.username,
        displayName: member.user.displayName,
        avatarUrl: member.user.avatarUrl,
      }
      : null,
  });

  const mapJoinRequest = (request) => ({
    id: request.id,
    userId: request.userId,
    status: request.status,
    createdAt: request.createdAt,
    message: request.message || null,
    user: request.user
      ? {
        id: request.user.id,
        username: request.user.username,
        displayName: request.user.displayName,
        avatarUrl: request.user.avatarUrl,
      }
      : null,
  });

  const mapSessionItem = (session, viewer = {}) => {
    const canOwnerOverride = Boolean(viewer.isOwner);
    const canCancel = Boolean(canOwnerOverride && ['PLANNED', 'ACTIVE'].includes(session.status));
    const canDelete = Boolean(canOwnerOverride && session.status === 'PLANNED');
    const ownerDisplayName = session?.owner?.displayName || session?.owner?.username || null;
    const hasParticipantsProjection = Array.isArray(session?.participants);
    const participants = hasParticipantsProjection ? session.participants : [];
    const playersCount = participants.filter(
      (participant) => participant.role === 'PLAYER' && participant.status !== 'DECLINED'
    ).length;
    const participantsCount = hasParticipantsProjection
      ? playersCount
      : (session?._count?.participants || 0);

    return {
      id: session.id,
      title: session.title,
      description: session.description || null,
      date: session.date,
      status: session.status,
      visibility: session.visibility,
      system: session.system || null,
      ownerId: session.ownerId,
      owner: mapOwner(session.owner),
      organizerName: ownerDisplayName,
      maxPlayers: session.maxPlayers || null,
      participantsSummaryCount: participantsCount,
      actions: {
        canCancel,
        canDelete,
      },
    };
  };

  const canReadMembersSection = (campaign, viewer = {}) => {
    if (!campaign) return false;

    if (campaign.visibility === 'PUBLIC') {
      return true;
    }

    return Boolean(viewer.isOwner || viewer.isMember || viewer.canManage);
  };

  const canModerateJoinRequests = (campaign, viewer = {}) => {
    if (!campaign) return false;

    const isFinished = campaign.status === 'FINISHED';
    if (isFinished) return false;

    return Boolean(viewer.isOwner || viewer.role === 'GM');
  };

  const buildAvailableTabs = ({ canEditSettings }) => {
    return [
      'sessions',
      'details',
      ...(canEditSettings ? ['settings'] : []),
    ];
  };

  const buildCampaignPageDto = async ({ campaign, userId = null }) => {
    const viewer = campaign?.viewer || {};
    const members = Array.isArray(campaign?.members) ? campaign.members : [];
    const sessions = Array.isArray(campaign?.sessions) ? campaign.sessions : [];

    const isOwner = Boolean(viewer.isOwner);
    const isMember = Boolean(viewer.isMember || isOwner);
    const isFinished = campaign.status === 'FINISHED';
    const canReadMembers = canReadMembersSection(campaign, viewer);
    const canReadJoinRequests = canModerateJoinRequests(campaign, viewer);

    const actions = {
      canSubmitJoinRequest: Boolean(
        userId
        && !isMember
        && !viewer.pendingJoinRequestStatus
        && !isFinished
        && viewer.joinMode === 'REQUEST'
      ),
      canLeave: Boolean(isMember && !isOwner && !isFinished),
      canEditSettings: Boolean(viewer.canManage),
      canTransferOwnership: Boolean(isOwner && !isFinished),
      canManageShareLink: Boolean(isOwner && campaign.visibility === 'LINK_ONLY' && !isFinished),
      canCreateSessions: Boolean((isOwner || viewer.role === 'GM') && !isFinished),
    };

    let joinRequestItems = [];
    if (canReadJoinRequests) {
      const rawJoinRequests = await getJoinRequests(campaign.id, userId);
      joinRequestItems = Array.isArray(rawJoinRequests) ? rawJoinRequests.map(mapJoinRequest) : [];
    }

    const visibleSessions = filterCampaignSessionsForViewer(sessions, viewer);
    const sessionItems = visibleSessions.map((session) => mapSessionItem(session, viewer));

    return {
      entity: {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        visibility: campaign.visibility,
        imageUrl: campaign.imageUrl,
        system: campaign.system,
        createdAt: campaign.createdAt,
        ownerId: campaign.ownerId,
        owner: mapOwner(campaign.owner),
      },
      viewer: {
        role: viewer.role || (isOwner ? 'OWNER' : null),
        isOwner,
        isMember,
        pendingJoinRequestStatus: viewer.pendingJoinRequestStatus || null,
      },
      actions,
      sections: {
        members: {
          visible: canReadMembers,
          count: members.length,
          items: canReadMembers ? members.map(mapMember) : [],
        },
        joinRequests: {
          visible: canReadJoinRequests,
          count: joinRequestItems.length,
          items: joinRequestItems,
        },
        sessions: {
          visible: true,
          count: sessionItems.length,
          items: sessionItems,
        },
      },
      ui: {
        previewMode: !isMember,
        availableTabs: buildAvailableTabs({ canEditSettings: actions.canEditSettings }),
      },
    };
  };

  const getCampaignPageById = async (campaignId, userId = null) => {
    const campaign = await getCampaignById(campaignId, userId);
    return buildCampaignPageDto({ campaign, userId });
  };

  const getCampaignPageByShareToken = async (rawToken, userId = null) => {
    const campaign = await getCampaignByShareToken(rawToken, userId);
    return buildCampaignPageDto({ campaign, userId });
  };

  return {
    buildCampaignPageDto,
    getCampaignPageById,
    getCampaignPageByShareToken,
  };
}

module.exports = createCampaignPageService;
