const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionPageService = require('../../src/services/session/session-page.service');

function buildSession(overrides = {}) {
  return {
    id: 55,
    title: 'Session title',
    description: 'Session description',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    status: 'PLANNED',
    visibility: 'PUBLIC',
    system: 'D&D 5e',
    price: 0,
    maxPlayers: 4,
    ownerId: 10,
    campaignId: null,
    owner: {
      id: 10,
      username: 'owner_user',
      displayName: 'Owner',
      avatarUrl: null,
    },
    campaign: null,
    participants: [],
    viewer: {
      role: 'OWNER',
      isSessionOwner: true,
      isParticipant: true,
      isCampaignMember: false,
      isCampaignOwner: false,
      participationStatus: 'CONFIRMED',
      canManage: true,
      canManageParticipants: true,
      joinMode: 'OPEN',
    },
    ...overrides,
  };
}

function createServiceWithSession(session) {
  return createSessionPageService({
    sessionQueryService: {
      getSessionById: async () => session,
      getSessionByShareToken: async () => session,
    },
  });
}

test('campaign member gets campaign link for LINK_ONLY campaign from session page', async () => {
  const session = buildSession({
    visibility: 'PUBLIC',
    campaignId: 901,
    campaign: {
      id: 901,
      title: 'Hidden Realm',
      visibility: 'LINK_ONLY',
      status: 'ACTIVE',
      system: 'D&D 5e',
      ownerId: 50,
    },
    viewer: {
      role: null,
      isSessionOwner: false,
      isParticipant: false,
      isCampaignMember: true,
      isCampaignOwner: false,
      participationStatus: null,
      canManage: false,
      canManageParticipants: false,
      joinMode: 'MEMBERS_ONLY',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 33);

  assert.equal(page.sections.campaign.visible, true);
  assert.equal(page.sections.campaign.linkable, true);
  assert.equal(page.sections.campaign.data?.id, 901);
  assert.equal(page.entity.campaign?.id, 901);
});

test('outsider in PUBLIC session of LINK_ONLY campaign sees campaign title without link', async () => {
  const session = buildSession({
    visibility: 'PUBLIC',
    campaignId: 902,
    campaign: {
      id: 902,
      title: 'Private Archive',
      visibility: 'LINK_ONLY',
      status: 'ACTIVE',
      system: 'D&D 5e',
      ownerId: 51,
    },
    viewer: {
      role: null,
      isSessionOwner: false,
      isParticipant: false,
      isCampaignMember: false,
      isCampaignOwner: false,
      participationStatus: null,
      canManage: false,
      canManageParticipants: false,
      joinMode: 'REQUEST',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 44);

  assert.equal(page.sections.campaign.visible, true);
  assert.equal(page.sections.campaign.linkable, false);
  assert.equal(page.sections.campaign.data?.id, 902);
  assert.equal(page.entity.campaign?.id, 902);
});

test('non-guest participant in LINK_ONLY campaign session gets campaign link even when viewer flag is stale', async () => {
  const session = buildSession({
    visibility: 'PUBLIC',
    campaignId: 903,
    campaign: {
      id: 903,
      title: 'Fallback Entitlement Campaign',
      visibility: 'LINK_ONLY',
      status: 'ACTIVE',
      system: 'D&D 5e',
      ownerId: 52,
    },
    participants: [
      {
        id: 9011,
        userId: 33,
        role: 'PLAYER',
        status: 'CONFIRMED',
        isGuest: false,
        user: { id: 33, username: 'player33', displayName: null, avatarUrl: null },
      },
    ],
    viewer: {
      role: 'PLAYER',
      isSessionOwner: false,
      isParticipant: true,
      isCampaignMember: false,
      isCampaignOwner: false,
      participationStatus: 'CONFIRMED',
      canManage: false,
      canManageParticipants: false,
      joinMode: 'MEMBERS_ONLY',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 33);

  assert.equal(page.sections.campaign.visible, true);
  assert.equal(page.sections.campaign.linkable, true);
});

test('guest participant in LINK_ONLY campaign session sees campaign title without link', async () => {
  const session = buildSession({
    visibility: 'PUBLIC',
    campaignId: 904,
    campaign: {
      id: 904,
      title: 'Guest Restricted Campaign',
      visibility: 'LINK_ONLY',
      status: 'ACTIVE',
      system: 'D&D 5e',
      ownerId: 53,
    },
    participants: [
      {
        id: 9012,
        userId: 44,
        role: 'PLAYER',
        status: 'PENDING',
        isGuest: true,
        user: { id: 44, username: 'guest44', displayName: null, avatarUrl: null },
      },
    ],
    viewer: {
      role: 'PLAYER',
      isSessionOwner: false,
      isParticipant: true,
      isCampaignMember: false,
      isCampaignOwner: false,
      participationStatus: 'PENDING',
      canManage: false,
      canManageParticipants: false,
      joinMode: 'REQUEST',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 44);

  assert.equal(page.sections.campaign.visible, true);
  assert.equal(page.sections.campaign.linkable, false);
  assert.equal(page.sections.campaign.data?.id, 904);
  assert.equal(page.entity.campaign?.id, 904);
});
