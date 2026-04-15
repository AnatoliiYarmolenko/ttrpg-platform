const test = require('node:test');
const assert = require('node:assert/strict');

const createCampaignPageService = require('../../src/services/campaign/campaign-page.service');

function buildCampaign(overrides = {}) {
  return {
    id: 71,
    title: 'Campaign title',
    description: 'Campaign description',
    status: 'ACTIVE',
    visibility: 'PRIVATE',
    imageUrl: null,
    system: 'D&D 5e',
    createdAt: new Date().toISOString(),
    ownerId: 10,
    owner: {
      id: 10,
      username: 'owner_user',
      displayName: 'Owner',
      avatarUrl: null,
    },
    members: [
      {
        id: 1,
        userId: 10,
        role: 'OWNER',
        user: {
          id: 10,
          username: 'owner_user',
          displayName: 'Owner',
          avatarUrl: null,
        },
      },
      {
        id: 2,
        userId: 11,
        role: 'GM',
        user: {
          id: 11,
          username: 'gm_user',
          displayName: 'GM',
          avatarUrl: null,
        },
      },
    ],
    sessions: [
      {
        id: 501,
        title: 'Planned session',
        date: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'PLANNED',
        ownerId: 11,
        maxPlayers: 5,
      },
      {
        id: 502,
        title: 'Active session',
        date: new Date().toISOString(),
        status: 'ACTIVE',
        ownerId: 11,
        maxPlayers: 5,
      },
    ],
    viewer: {
      role: null,
      isOwner: false,
      isMember: false,
      pendingJoinRequestStatus: null,
      canManage: false,
      joinMode: 'REQUEST',
    },
    ...overrides,
  };
}

function createServiceWithData({ campaignById, campaignByShare, joinRequests = [] }) {
  return createCampaignPageService({
    getCampaignById: async () => campaignById,
    getCampaignByShareToken: async () => campaignByShare || campaignById,
    getJoinRequests: async () => joinRequests,
  });
}

test('outsider receives hidden members and no moderation actions', async () => {
  const campaign = buildCampaign({
    viewer: {
      role: null,
      isOwner: false,
      isMember: false,
      pendingJoinRequestStatus: null,
      canManage: false,
      joinMode: 'REQUEST',
    },
  });

  const service = createServiceWithData({ campaignById: campaign });
  const page = await service.getCampaignPageById(campaign.id, 42);

  assert.equal(page.sections.members.visible, false);
  assert.deepEqual(page.sections.members.items, []);
  assert.equal(page.sections.joinRequests.visible, false);
  assert.deepEqual(page.sections.joinRequests.items, []);
  assert.equal(page.actions.canSubmitJoinRequest, true);
  assert.equal(page.ui.previewMode, true);
});

test('owner gets settings/create actions and per-item session actions', async () => {
  const campaign = buildCampaign({
    viewer: {
      role: 'OWNER',
      isOwner: true,
      isMember: true,
      pendingJoinRequestStatus: null,
      canManage: true,
      joinMode: 'REQUEST',
    },
  });

  const service = createServiceWithData({ campaignById: campaign });
  const page = await service.getCampaignPageById(campaign.id, 10);

  assert.equal(page.actions.canEditSettings, true);
  assert.equal(page.actions.canCreateSessions, true);
  assert.equal(page.actions.canManageShareLink, false);
  assert.equal(page.sections.members.visible, true);
  assert.equal(page.sections.sessions.items[0].actions.canCancel, true);
  assert.equal(page.sections.sessions.items[0].actions.canDelete, true);
  assert.equal(page.sections.sessions.items[1].actions.canCancel, true);
  assert.equal(page.sections.sessions.items[1].actions.canDelete, false);
  assert.equal(page.ui.availableTabs.includes('settings'), true);
  assert.equal(page.ui.previewMode, false);
});

test('GM can moderate join requests, but cannot get owner session override actions', async () => {
  const campaign = buildCampaign({
    viewer: {
      role: 'GM',
      isOwner: false,
      isMember: true,
      pendingJoinRequestStatus: null,
      canManage: false,
      joinMode: 'REQUEST',
    },
  });

  const joinRequests = [
    {
      id: 3001,
      userId: 77,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      message: 'hi',
      user: {
        id: 77,
        username: 'requester',
        displayName: 'Requester',
        avatarUrl: null,
      },
    },
  ];

  const service = createServiceWithData({ campaignById: campaign, joinRequests });
  const page = await service.getCampaignPageById(campaign.id, 11);

  assert.equal(page.sections.joinRequests.visible, true);
  assert.equal(page.sections.joinRequests.items.length, 1);
  assert.equal(page.sections.sessions.items[0].actions.canCancel, false);
  assert.equal(page.sections.sessions.items[0].actions.canDelete, false);
  assert.equal(page.actions.canCreateSessions, true);
  assert.equal(page.actions.canEditSettings, false);
});