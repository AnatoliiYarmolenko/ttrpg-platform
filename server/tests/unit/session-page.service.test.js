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
    participants: [
      {
        id: 501,
        userId: 10,
        role: 'GM',
        status: 'CONFIRMED',
        isGuest: false,
        user: {
          id: 10,
          username: 'owner_user',
          displayName: 'Owner',
          avatarUrl: null,
        },
      },
      {
        id: 502,
        userId: 11,
        role: 'PLAYER',
        status: 'CONFIRMED',
        isGuest: false,
        user: {
          id: 11,
          username: 'player_user',
          displayName: 'Player',
          avatarUrl: null,
        },
      },
    ],
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

test('hides participants section for outsider viewer', async () => {
  const session = buildSession({
    ownerId: 99,
    participants: [
      {
        id: 601,
        userId: 77,
        role: 'PLAYER',
        status: 'CONFIRMED',
        isGuest: false,
        user: { id: 77, username: 'player77', displayName: null, avatarUrl: null },
      },
    ],
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
  const page = await service.getSessionPageById(session.id, 42);

  assert.equal(page.sections.participants.visible, false);
  assert.deepEqual(page.sections.participants.items, []);
  assert.equal(page.ui.previewMode, true);
});

test('includes management actions for owner and exposes settings tab', async () => {
  const session = buildSession();
  const service = createServiceWithSession(session);

  const page = await service.getSessionPageById(session.id, 10);

  assert.equal(page.actions.canEditSettings, true);
  assert.equal(page.actions.canDelete, true);
  assert.equal(page.actions.canCancel, true);
  assert.equal(page.actions.canManageParticipants, true);
  assert.equal(page.ui.availableTabs.includes('settings'), true);
  assert.equal(page.ui.availableTabs.includes('manage'), false);
  assert.equal(page.ui.previewMode, false);
});

test('confirmed GM can cancel only active session and cannot edit settings', async () => {
  const session = buildSession({
    ownerId: 10,
    status: 'ACTIVE',
    participants: [
      {
        id: 701,
        userId: 33,
        role: 'GM',
        status: 'CONFIRMED',
        isGuest: false,
        user: { id: 33, username: 'gm33', displayName: null, avatarUrl: null },
      },
    ],
    viewer: {
      role: 'GM',
      isSessionOwner: false,
      isParticipant: true,
      isCampaignMember: false,
      isCampaignOwner: false,
      participationStatus: 'CONFIRMED',
      canManage: false,
      canManageParticipants: true,
      joinMode: 'REQUEST',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 33);

  assert.equal(page.actions.canCancel, true);
  assert.equal(page.actions.canDelete, false);
  assert.equal(page.actions.canEditSettings, false);
  assert.equal(page.actions.canManageShareLink, false);
});

test('confirmed player can manage share link for one-shot LINK_ONLY session without confirmed GM', async () => {
  const session = buildSession({
    visibility: 'LINK_ONLY',
    campaignId: null,
    ownerId: 10,
    participants: [
      {
        id: 711,
        userId: 10,
        role: 'PLAYER',
        status: 'CONFIRMED',
        isGuest: false,
        user: { id: 10, username: 'owner_player', displayName: null, avatarUrl: null },
      },
      {
        id: 712,
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
      joinMode: 'OPEN',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 33);

  assert.equal(page.actions.canManageShareLink, true);
  assert.equal(page.ui.availableTabs.includes('settings'), true);
  assert.equal(page.ui.availableTabs.includes('manage'), false);
});

test('share-token endpoint reuses page DTO builder', async () => {
  const session = buildSession({
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
  const page = await service.getSessionPageByShareToken('sample-share-token', 44);

  assert.equal(page.entity.id, 55);
  assert.equal(page.actions.canJoin, true);
  assert.equal(page.actions.canApplyAsGm, false);
});

test('campaign owner override grants only cancel/delete for чужої campaign session', async () => {
  const session = buildSession({
    status: 'PLANNED',
    ownerId: 77,
    campaignId: 901,
    campaign: {
      id: 901,
      title: 'Campaign title',
      visibility: 'PRIVATE',
      status: 'ACTIVE',
      system: 'D&D 5e',
      ownerId: 42,
    },
    participants: [
      {
        id: 801,
        userId: 77,
        role: 'GM',
        status: 'CONFIRMED',
        isGuest: false,
        user: { id: 77, username: 'session_gm', displayName: null, avatarUrl: null },
      },
    ],
    viewer: {
      role: null,
      isSessionOwner: false,
      isParticipant: false,
      isCampaignMember: false,
      isCampaignOwner: true,
      participationStatus: null,
      canManage: false,
      canManageParticipants: false,
      joinMode: 'MEMBERS_ONLY',
    },
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 42);

  assert.equal(page.actions.canCancel, true);
  assert.equal(page.actions.canDelete, true);
  assert.equal(page.actions.canEditSettings, false);
  assert.equal(page.actions.canManageParticipants, false);
  assert.equal(page.actions.canManageGmRequests, false);
  assert.equal(page.ui.availableTabs.includes('settings'), true);
  assert.equal(page.ui.availableTabs.includes('manage'), false);
});

test('finished session disables settings and share-link management actions', async () => {
  const session = buildSession({
    status: 'FINISHED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    visibility: 'LINK_ONLY',
    campaignId: null,
    campaign: null,
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
  });

  const service = createServiceWithSession(session);
  const page = await service.getSessionPageById(session.id, 10);

  assert.equal(page.actions.canEditSettings, false);
  assert.equal(page.actions.canManageShareLink, false);
  assert.equal(page.ui.availableTabs.includes('settings'), false);
  assert.equal(page.ui.availableTabs.includes('manage'), false);
});
