const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionQueryService = require('../../src/services/session/session-query.service');
const { hashToken } = require('../../src/utils/token.helper');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  SECURITY_ACCESS_DENIED: 'SECURITY_ACCESS_DENIED',
};

function buildSession(overrides = {}) {
  return {
    id: 55,
    ownerId: 10,
    title: 'Campaign Session',
    status: 'PLANNED',
    visibility: 'PRIVATE',
    date: new Date(Date.now() + 3_600_000).toISOString(),
    campaignId: 901,
    owner: {
      id: 10,
      username: 'gm_owner',
      displayName: 'GM Owner',
      avatarUrl: null,
    },
    campaign: {
      id: 901,
      title: 'Hidden Realm',
      visibility: 'LINK_ONLY',
      ownerId: 50,
      status: 'ACTIVE',
      system: 'D&D 5e',
      shareTokenHash: hashToken('campaign-access-token'),
    },
    participants: [
      {
        id: 501,
        userId: 10,
        role: 'GM',
        status: 'CONFIRMED',
        isGuest: false,
        user: {
          id: 10,
          username: 'gm_owner',
          displayName: 'GM Owner',
          avatarUrl: null,
        },
      },
    ],
    shareTokenHash: null,
    shareTokenEncrypted: null,
    shareTokenCreatedAt: null,
    ...overrides,
  };
}

function createPrisma({ session, campaignMembership = null }) {
  return {
    session: {
      findUnique: async () => session,
      findFirst: async () => null,
    },
    campaignMember: {
      findUnique: async () => campaignMembership,
    },
  };
}

test('campaign member can open PRIVATE session inside LINK_ONLY campaign by id', async () => {
  const session = buildSession();
  const service = createSessionQueryService({
    prisma: createPrisma({
      session,
      campaignMembership: { role: 'PLAYER' },
    }),
    AppError,
    ERROR_CODES,
  });

  const result = await service.getSessionById(session.id, 33);

  assert.equal(result.id, session.id);
  assert.equal(result.viewer.isCampaignMember, true);
  assert.equal(result.viewer.canOpen, true);
  assert.equal(result.viewer.joinMode, 'MEMBERS_ONLY');
});

test('valid campaign share token can open PRIVATE session inside LINK_ONLY campaign for non-member viewer', async () => {
  const session = buildSession();
  const service = createSessionQueryService({
    prisma: createPrisma({
      session,
      campaignMembership: null,
    }),
    AppError,
    ERROR_CODES,
  });

  const result = await service.getSessionById(session.id, 44, {
    campaignShareToken: 'campaign-access-token',
  });

  assert.equal(result.id, session.id);
  assert.equal(result.viewer.isCampaignMember, false);
  assert.equal(result.viewer.canOpen, true);
  assert.equal(result.viewer.joinMode, 'MEMBERS_ONLY');
});

test('non-member without campaign share token cannot open PRIVATE session inside LINK_ONLY campaign', async () => {
  const session = buildSession();
  const service = createSessionQueryService({
    prisma: createPrisma({
      session,
      campaignMembership: null,
    }),
    AppError,
    ERROR_CODES,
  });

  await assert.rejects(
    () => service.getSessionById(session.id, 44),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
  );
});
