const test = require('node:test');
const assert = require('node:assert/strict');

const sessionService = require('../../src/services/session.service');
const createSessionCalendarService = require('../../src/services/session/session-calendar.service');
const { prisma } = require('../../src/lib/prisma');
const permissionHelpers = require('../../src/services/session/session-permission.helpers');
const { createRawEncryptedAndHashedShareToken } = require('../../src/utils/token.helper');

class CalendarAppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const CALENDAR_ERROR_CODES = {
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
};

function buildCalendarService(mockSessions) {
  const state = {
    whereCalls: [],
  };

  const calendarPrisma = {
    session: {
      findMany: async (args) => {
        state.whereCalls.push(args.where);
        return mockSessions;
      },
    },
  };

  const service = createSessionCalendarService({
    prisma: calendarPrisma,
    AppError: CalendarAppError,
    ERROR_CODES: CALENDAR_ERROR_CODES,
  });

  return { service, state };
}

function withMockedPrismaUpdate(mockImpl, callback) {
  const originalUpdate = prisma.session.update;
  prisma.session.update = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      prisma.session.update = originalUpdate;
    });
}

function withMockedCanChangeSessionStatus(mockImpl, callback) {
  const original = permissionHelpers._canChangeSessionStatus;
  permissionHelpers._canChangeSessionStatus = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      permissionHelpers._canChangeSessionStatus = original;
    });
}

function withMockedSessionById(mockImpl, callback) {
  const original = sessionService.queryService.getSessionById;
  sessionService.queryService.getSessionById = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      sessionService.queryService.getSessionById = original;
    });
}

function withMockedPrismaFindUnique(mockImpl, callback) {
  const originalFindUnique = prisma.session.findUnique;
  prisma.session.findUnique = mockImpl;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      prisma.session.findUnique = originalFindUnique;
    });
}

test('Campaign owner can cancel foreign PLANNED session in own campaign', async () => {
  const session = {
    id: 300,
    ownerId: 22,
    status: 'PLANNED',
    campaign: { ownerId: 11 },
    participants: [],
  };

  let updateCallCount = 0;

  await withMockedPrismaUpdate(async () => {
    updateCallCount += 1;
    return {
      id: session.id,
      status: 'CANCELED',
      owner: { id: session.ownerId, username: 'gm_foreign' },
      participants: [],
    };
  }, async () => {
    const result = await sessionService.cancelSession(session.id, 11, { preloadedSession: session });

    assert.equal(result.status, 'CANCELED');
    assert.equal(updateCallCount, 1);
  });
});

test('confirmed GM can cancel ACTIVE session', async () => {
  const session = {
    id: 301,
    ownerId: 22,
    status: 'ACTIVE',
    campaign: { ownerId: 99 },
    participants: [
      { id: 1, userId: 33, role: 'GM', status: 'CONFIRMED' },
    ],
  };

  await withMockedCanChangeSessionStatus(
    (targetSession, userId) => targetSession.id === 301 && userId === 33,
    async () => {
      await withMockedPrismaUpdate(async () => ({
        id: session.id,
        status: 'CANCELED',
        owner: { id: session.ownerId, username: 'gm_foreign' },
        participants: [],
      }), async () => {
        const result = await sessionService.cancelSession(session.id, 33, { preloadedSession: session });
        assert.equal(result.status, 'CANCELED');
      });
    }
  );
});

test('confirmed GM cannot cancel PLANNED session', async () => {
  const session = {
    id: 302,
    ownerId: 22,
    status: 'PLANNED',
    campaign: { ownerId: 99 },
    participants: [
      { id: 1, userId: 33, role: 'GM', status: 'CONFIRMED' },
    ],
  };

  await withMockedCanChangeSessionStatus(
    (targetSession, userId) => targetSession.id === 302 && userId === 33,
    async () => {
      await assert.rejects(
        () => sessionService.cancelSession(session.id, 33, { preloadedSession: session }),
        (error) => error?.code === 'SESSION_OWNER_ONLY'
      );
    }
  );
});

test('Cannot update session settings when campaign is finished', async () => {
  const preloadedSession = {
    id: 451,
    ownerId: 11,
    status: 'PLANNED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 901,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: {
      id: 88,
      ownerId: 11,
      status: 'FINISHED',
    },
  };

  await assert.rejects(
    () => sessionService.updateSession(preloadedSession.id, 11, { title: 'РќРѕРІРёР№ Р·Р°РіРѕР»РѕРІРѕРє' }, { preloadedSession }),
    (error) => error?.code === 'CAMPAIGN_FINISHED'
  );
});

test('Cannot create campaign session with LINK_ONLY visibility', async () => {
  const originalAssertNoConflict = sessionService._assertNoSessionTimeConflict;
  sessionService._assertNoSessionTimeConflict = async () => true;

  try {
    await assert.rejects(
      () => sessionService.createSession({
        title: 'Blocked campaign session',
        description: null,
        date: new Date(Date.now() + 86_400_000),
        duration: 180,
        maxPlayers: 4,
        price: 0,
        campaignId: 10,
        ownerId: 1,
        visibility: 'LINK_ONLY',
        system: 'D&D 5e',
        isGm: true,
      }),
      (error) => error?.code === 'VALIDATION_FAILED' && /LINK_ONLY/i.test(error.message)
    );
  } finally {
    sessionService._assertNoSessionTimeConflict = originalAssertNoConflict;
  }
});

test('Cannot update campaign session visibility to LINK_ONLY', async () => {
  const preloadedSession = {
    id: 701,
    campaignId: 88,
    ownerId: 11,
    status: 'PLANNED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 1001,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: {
      id: 88,
      ownerId: 11,
      status: 'ACTIVE',
    },
  };

  await assert.rejects(
    () => sessionService.updateSession(
      preloadedSession.id,
      11,
      { visibility: 'LINK_ONLY' },
      { preloadedSession }
    ),
    (error) => error?.code === 'SESSION_LINK_ONLY_ONE_SHOT_ONLY'
  );
});

test('Confirmed player can regenerate share link for one-shot LINK_ONLY session without confirmed GM', async () => {
  const session = {
    id: 901,
    ownerId: 10,
    campaignId: null,
    visibility: 'LINK_ONLY',
    campaign: null,
    participants: [
      { id: 1, userId: 10, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, userId: 33, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  };

  await withMockedSessionById(
    async () => session,
    async () => {
      await withMockedPrismaUpdate(async () => ({ id: session.id }), async () => {
        const result = await sessionService.regenerateShareToken(session.id, 33);
        assert.equal(result.sessionId, session.id);
        assert.equal(typeof result.token, 'string');
        assert.equal(result.token.length > 0, true);
      });
    }
  );
});

test('Confirmed player can read share link for one-shot LINK_ONLY session without confirmed GM', async () => {
  const shareTokenData = createRawEncryptedAndHashedShareToken();
  const session = {
    id: 902,
    ownerId: 10,
    campaignId: null,
    visibility: 'LINK_ONLY',
    campaign: null,
    participants: [
      { id: 1, userId: 10, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, userId: 33, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  };

  await withMockedSessionById(
    async () => session,
    async () => {
      await withMockedPrismaFindUnique(
        async () => ({ shareTokenEncrypted: shareTokenData.tokenEncrypted }),
        async () => {
          const result = await sessionService.getSessionShareLink(session.id, 33);
          assert.equal(typeof result.token, 'string');
          assert.equal(result.shareUrl.includes('/session/share/'), true);
        }
      );
    }
  );
});

test('Cannot update settings for FINISHED session', async () => {
  const preloadedSession = {
    id: 903,
    ownerId: 11,
    status: 'FINISHED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 1101,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: null,
  };

  await assert.rejects(
    () => sessionService.updateSession(preloadedSession.id, 11, { title: 'Updated title' }, { preloadedSession }),
    (error) => error?.code === 'SESSION_SETTINGS_UPDATE_FORBIDDEN'
  );
});

test('Cannot update settings for CANCELED session', async () => {
  const preloadedSession = {
    id: 904,
    ownerId: 11,
    status: 'CANCELED',
    date: new Date(Date.now() + 86_400_000).toISOString(),
    duration: 180,
    participants: [
      {
        id: 1102,
        userId: 11,
        role: 'GM',
        status: 'CONFIRMED',
      },
    ],
    campaign: null,
  };

  await assert.rejects(
    () => sessionService.updateSession(preloadedSession.id, 11, { title: 'Updated title' }, { preloadedSession }),
    (error) => error?.code === 'SESSION_SETTINGS_UPDATE_FORBIDDEN'
  );
});

test('Cannot regenerate share link for FINISHED LINK_ONLY session', async () => {
  const session = {
    id: 905,
    ownerId: 10,
    status: 'FINISHED',
    campaignId: null,
    visibility: 'LINK_ONLY',
    campaign: null,
    participants: [
      { id: 1, userId: 10, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  };

  await withMockedSessionById(
    async () => session,
    async () => {
      await assert.rejects(
        () => sessionService.regenerateShareToken(session.id, 10),
        (error) => error?.code === 'SECURITY_ACCESS_DENIED'
      );
    }
  );
});

test('Global calendar filter for authenticated users includes PRIVATE one-shot and PRIVATE campaign clauses', async () => {
  const { service, state } = buildCalendarService([]);

  await service.getCalendarStats(42, {
    month: '2026-03-01',
    scope: 'global',
    filters: {},
  });

  const where = state.whereCalls[0];
  const visibilityClauses = where.AND?.[0]?.OR || [];

  const hasOneShotPrivateClause = visibilityClauses.some(
    (clause) => clause.campaignId === null && clause.visibility?.in?.includes('PRIVATE')
  );
  const hasCampaignPrivateClause = visibilityClauses.some(
    (clause) => clause.campaignId?.not === null && clause.visibility === 'PRIVATE'
  );

  assert.equal(hasOneShotPrivateClause, true);
  assert.equal(hasCampaignPrivateClause, true);
});

test('Global calendar filter for anonymous users is PUBLIC-only', async () => {
  const { service, state } = buildCalendarService([]);

  await service.getCalendarStats(null, {
    month: '2026-03-01',
    scope: 'global',
    filters: {},
  });

  const where = state.whereCalls[0];
  const visibilityClauses = where.AND?.[0]?.OR || [];

  assert.equal(visibilityClauses.length, 2);
  assert.equal(visibilityClauses.every((clause) => clause.visibility === 'PUBLIC'), true);
});

test('Day sessions keep campaign title but hide campaign id for outsider in PUBLIC session of LINK_ONLY campaign', async () => {
  const mockSessions = [
    {
      id: 1,
      title: 'Guest Session',
      date: new Date('2026-03-12T18:00:00.000Z'),
      status: 'PLANNED',
      visibility: 'PUBLIC',
      campaignId: 77,
      owner: {
        id: 10,
        username: 'owner',
        displayName: null,
        avatarUrl: null,
      },
      campaign: {
        id: 77,
        title: 'Hidden Campaign',
        system: 'D&D 5e',
        visibility: 'LINK_ONLY',
        ownerId: 100,
        members: [],
      },
      participants: [],
    },
  ];

  const { service } = buildCalendarService(mockSessions);

  const sessions = await service.getSessionsByDayFiltered(42, '2026-03-12', 'global', {});

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].campaign?.title, 'Hidden Campaign');
  assert.equal(sessions[0].campaign?.id, null);
  assert.equal(sessions[0].campaign?.canOpenDirectly, false);
});

test('Day sessions keep campaign info for campaign member in PUBLIC session of LINK_ONLY campaign', async () => {
  const mockSessions = [
    {
      id: 2,
      title: 'Member Session',
      date: new Date('2026-03-12T18:00:00.000Z'),
      status: 'PLANNED',
      visibility: 'PUBLIC',
      campaignId: 78,
      owner: {
        id: 10,
        username: 'owner',
        displayName: null,
        avatarUrl: null,
      },
      campaign: {
        id: 78,
        title: 'Visible For Members',
        system: 'Pathfinder 2e',
        visibility: 'LINK_ONLY',
        ownerId: 100,
        members: [{ userId: 42 }],
      },
      participants: [],
    },
  ];

  const { service } = buildCalendarService(mockSessions);

  const sessions = await service.getSessionsByDayFiltered(42, '2026-03-12', 'global', {});

  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].campaign?.id, 78);
  assert.equal(sessions[0].campaign?.title, 'Visible For Members');
});

