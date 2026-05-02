const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionCalendarService = require('../../src/services/session/session-calendar.service');

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

test('global calendar filter for authenticated users includes PRIVATE one-shot and PRIVATE campaign clauses', async () => {
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

test('global calendar filter for anonymous users is PUBLIC-only', async () => {
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

test('day sessions keep campaign title but hide campaign id for outsider in PUBLIC session of LINK_ONLY campaign', async () => {
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

test('day sessions keep campaign info for campaign member in PUBLIC session of LINK_ONLY campaign', async () => {
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
