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
        id: 600,
        userId: 99,
        role: 'GM',
        status: 'CONFIRMED',
        isGuest: false,
        user: { id: 99, username: 'gm99', displayName: null, avatarUrl: null },
      },
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
  assert.equal(page.sections.participants.count, 1);
  assert.equal(page.sections.participants.hasConfirmedGm, true);
  assert.deepEqual(page.sections.participants.items, []);
  assert.equal(page.ui.previewMode, true);
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
