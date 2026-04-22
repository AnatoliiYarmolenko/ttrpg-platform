const { canOpenCampaign } = require('./access-rules');

function appendAndClause(whereCondition, clause) {
  whereCondition.AND = whereCondition.AND || [];
  whereCondition.AND.push(clause);
}

function buildEntitledCampaignSessionFilter(userId) {
  return {
    OR: [
      {
        campaign: {
          ownerId: userId,
        },
      },
      {
        campaign: {
          members: {
            some: { userId },
          },
        },
      },
      {
        participants: {
          some: { userId },
        },
      },
      {
        ownerId: userId,
      },
    ],
  };
}

function buildEntitledOneShotLinkOnlyFilter(userId) {
  return {
    OR: [
      {
        ownerId: userId,
      },
      {
        participants: {
          some: { userId },
        },
      },
    ],
  };
}

function buildSessionDiscoveryFilter(userId = null) {
  if (!userId) {
    return [
      {
        campaignId: null,
        visibility: 'PUBLIC',
      },
      {
        campaignId: { not: null },
        visibility: 'PUBLIC',
      },
    ];
  }

  return [
    {
      campaignId: null,
      visibility: { in: ['PUBLIC', 'PRIVATE'] },
    },
    {
      campaignId: null,
      visibility: 'LINK_ONLY',
      ...buildEntitledOneShotLinkOnlyFilter(userId),
    },
    {
      campaignId: { not: null },
      visibility: 'PUBLIC',
    },
    {
      campaignId: { not: null },
      visibility: 'PRIVATE',
      ...buildEntitledCampaignSessionFilter(userId),
    },
    {
      campaignId: { not: null },
      visibility: 'LINK_ONLY',
      ...buildEntitledCampaignSessionFilter(userId),
    },
  ];
}

function applySessionDiscoveryFilter(whereCondition, userId = null) {
  appendAndClause(whereCondition, { OR: buildSessionDiscoveryFilter(userId) });
}

function buildCampaignDiscoveryFilter(userId = null) {
  if (!userId) {
    return [{ visibility: 'PUBLIC' }];
  }

  return [
    {
      visibility: 'PUBLIC',
    },
    {
      visibility: 'LINK_ONLY',
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
  ];
}

function applyCampaignDiscoveryFilter(whereCondition, userId = null) {
  appendAndClause(whereCondition, { OR: buildCampaignDiscoveryFilter(userId) });
}

function buildNestedCampaignSelectForViewer(userId = null) {
  const campaignSelect = {
    id: true,
    title: true,
    system: true,
    visibility: true,
    ownerId: true,
  };

  if (userId) {
    campaignSelect.members = {
      where: { userId },
      select: { userId: true },
    };
  }

  return campaignSelect;
}

function canViewerOpenNestedCampaign(campaign, userId = null) {
  if (!campaign) {
    return false;
  }

  const isOwner = Boolean(userId && campaign.ownerId === userId);
  const isCampaignMember = isOwner || (
    Array.isArray(campaign.members)
    && campaign.members.some((member) => member.userId === userId)
  );

  return canOpenCampaign({
    visibility: campaign.visibility,
    isOwner,
    isCampaignMember,
    userId,
    hasValidShareToken: false,
  });
}

function sanitizeNestedCampaignForSession(session, userId = null) {
  if (!session?.campaign) {
    return null;
  }

  const canOpenDirectly = canViewerOpenNestedCampaign(session.campaign, userId);

  return {
    id: canOpenDirectly ? session.campaign.id : null,
    title: session.campaign.title || null,
    system: session.campaign.system || null,
    visibility: session.campaign.visibility,
    canOpenDirectly,
  };
}

function filterCampaignSessionsForViewer(sessions = [], viewer = {}) {
  if (viewer.isOwner || viewer.isMember || viewer.canManage) {
    return sessions;
  }

  return sessions.filter((session) => session?.visibility === 'PUBLIC');
}

module.exports = {
  applyCampaignDiscoveryFilter,
  applySessionDiscoveryFilter,
  buildCampaignDiscoveryFilter,
  buildNestedCampaignSelectForViewer,
  buildSessionDiscoveryFilter,
  filterCampaignSessionsForViewer,
  sanitizeNestedCampaignForSession,
};
