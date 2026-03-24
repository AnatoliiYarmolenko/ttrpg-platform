const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionParticipantsService = require('../src/services/session/session-participants.service');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SESSION_GM_ALREADY_EXISTS: 'SESSION_GM_ALREADY_EXISTS',
  SECURITY_ACCESS_DENIED: 'SECURITY_ACCESS_DENIED',
  CAMPAIGN_FINISHED: 'CAMPAIGN_FINISHED',
  SESSION_TIME_CONFLICT_PLAYER: 'SESSION_TIME_CONFLICT_PLAYER',
};

function buildSession(overrides = {}) {
  return {
    id: 100,
    campaignId: null,
    campaign: null,
    status: 'PLANNED',
    visibility: 'PUBLIC',
    date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    duration: 180,
    maxPlayers: 4,
    participants: [],
    viewer: {
      isCampaignMember: false,
    },
    ...overrides,
  };
}

function buildJoinServiceContext(options = {}) {
  const state = {
    createdParticipants: [],
    conflictChecks: 0,
  };

  const session = options.session || buildSession();

  const prisma = {
    sessionParticipant: {
      findUnique: async ({ where }) => {
        if (where?.userId_sessionId) {
          return options.existingParticipant || null;
        }
        return null;
      },
      create: async ({ data }) => {
        state.createdParticipants.push(data);
        return {
          id: 900 + state.createdParticipants.length,
          ...data,
          user: {
            id: data.userId,
            username: `user_${data.userId}`,
            displayName: null,
            avatarUrl: null,
          },
        };
      },
    },
  };

  const service = createSessionParticipantsService({
    prisma,
    AppError,
    ERROR_CODES,
    getSessionById: async () => session,
    resolveSessionContext: async () => session,
    assertNoSessionTimeConflict: async () => {
      state.conflictChecks += 1;
      return true;
    },
    permissionHelpers: {
      _getConfirmedGm: (targetSession) =>
        targetSession.participants.find(
          (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
        ) || null,
      _isSessionOwner: () => false,
      _isCampaignOwnerOverride: () => false,
      _canManageParticipants: () => false,
    },
  });

  return { service, state };
}

test('one-shot PUBLIC join auto-confirms player', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({ campaignId: null, campaign: null, visibility: 'PUBLIC' }),
  });

  const participant = await service.joinSession(100, 10, { role: 'PLAYER' });

  assert.equal(state.createdParticipants.length, 1);
  assert.equal(state.createdParticipants[0].status, 'CONFIRMED');
  assert.equal(state.createdParticipants[0].isGuest, false);
  assert.equal(participant.status, 'CONFIRMED');
});

test('one-shot PRIVATE join requires approval (PENDING)', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({ campaignId: null, campaign: null, visibility: 'PRIVATE' }),
  });

  const participant = await service.joinSession(100, 10, { role: 'PLAYER' });

  assert.equal(state.createdParticipants.length, 1);
  assert.equal(state.createdParticipants[0].status, 'PENDING');
  assert.equal(participant.status, 'PENDING');
});

test('campaign PRIVATE session auto-confirms campaign member', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({
      campaignId: 500,
      campaign: { id: 500, status: 'ACTIVE' },
      visibility: 'PRIVATE',
      viewer: { isCampaignMember: true },
    }),
  });

  const participant = await service.joinSession(100, 10, { role: 'PLAYER' });

  assert.equal(state.createdParticipants.length, 1);
  assert.equal(state.createdParticipants[0].status, 'CONFIRMED');
  assert.equal(state.createdParticipants[0].isGuest, false);
  assert.equal(participant.status, 'CONFIRMED');
});

test('campaign PRIVATE session denies outsider join', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({
      campaignId: 500,
      campaign: { id: 500, status: 'ACTIVE' },
      visibility: 'PRIVATE',
      viewer: { isCampaignMember: false },
    }),
  });

  await assert.rejects(
    () => service.joinSession(100, 10, { role: 'PLAYER' }),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
  );

  assert.equal(state.createdParticipants.length, 0);
});

test('campaign PUBLIC session marks outsider as guest and creates pending join', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({
      campaignId: 500,
      campaign: { id: 500, status: 'ACTIVE' },
      visibility: 'PUBLIC',
      viewer: { isCampaignMember: false },
    }),
  });

  const participant = await service.joinSession(100, 10, { role: 'PLAYER' });

  assert.equal(state.createdParticipants.length, 1);
  assert.equal(state.createdParticipants[0].status, 'PENDING');
  assert.equal(state.createdParticipants[0].isGuest, true);
  assert.equal(participant.status, 'PENDING');
  assert.equal(participant.isGuest, true);
});

test('campaign PUBLIC session keeps campaign member as non-guest pending participant', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({
      campaignId: 500,
      campaign: { id: 500, status: 'ACTIVE' },
      visibility: 'PUBLIC',
      viewer: { isCampaignMember: true },
    }),
  });

  const participant = await service.joinSession(100, 10, { role: 'PLAYER' });

  assert.equal(state.createdParticipants.length, 1);
  assert.equal(state.createdParticipants[0].status, 'PENDING');
  assert.equal(state.createdParticipants[0].isGuest, false);
  assert.equal(participant.status, 'PENDING');
  assert.equal(participant.isGuest, false);
});

test('cannot join session when status is not PLANNED', async () => {
  const { service, state } = buildJoinServiceContext({
    session: buildSession({
      campaignId: null,
      campaign: null,
      visibility: 'PUBLIC',
      status: 'ACTIVE',
    }),
  });

  await assert.rejects(
    () => service.joinSession(100, 10, { role: 'PLAYER' }),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.VALIDATION_FAILED
  );

  assert.equal(state.createdParticipants.length, 0);
});
