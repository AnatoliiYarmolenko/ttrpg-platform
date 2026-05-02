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

test('outsider on PUBLIC campaign sees only PUBLIC sessions in campaign list', async () => {
  const campaign = buildCampaign({
    visibility: 'PUBLIC',
    sessions: [
      {
        id: 601,
        title: 'Guest Session',
        date: new Date(Date.now() + 86_400_000).toISOString(),
        status: 'PLANNED',
        visibility: 'PUBLIC',
        ownerId: 11,
        maxPlayers: 5,
      },
      {
        id: 602,
        title: 'Private Session',
        date: new Date(Date.now() + 172_800_000).toISOString(),
        status: 'PLANNED',
        visibility: 'PRIVATE',
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
  });

  const service = createServiceWithData({ campaignById: campaign });
  const page = await service.getCampaignPageById(campaign.id, 42);

  assert.equal(page.sections.sessions.items.length, 1);
  assert.equal(page.sections.sessions.items[0].id, 601);
  assert.equal(page.sections.sessions.items[0].title, 'Guest Session');
});
