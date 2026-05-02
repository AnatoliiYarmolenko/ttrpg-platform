const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionCalendarService = require('../../src/services/session/session-calendar.service');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
};

function buildService({ sessions, timezone = null }) {
  const prisma = {
    user: {
      findUnique: async () => ({ timezone }),
    },
    session: {
      findMany: async () => sessions,
    },
  };

  return createSessionCalendarService({
    prisma,
    AppError,
    ERROR_CODES,
  });
}

function buildSession(overrides = {}) {
  return {
    id: 1,
    date: new Date('2026-03-15T10:00:00.000Z'),
    system: 'D&D 5e',
    visibility: 'PUBLIC',
    campaignId: null,
    campaign: null,
    title: 'Dragon Hunt',
    description: 'Epic dragon battle',
    owner: { id: 100, username: 'gm', displayName: 'GM', avatarUrl: null },
    participants: [],
    ...overrides,
  };
}

test('calendar stats group sessions by requested timezone instead of raw UTC day', async () => {
  const service = buildService({
    sessions: [
      buildSession({
        id: 1,
        date: new Date('2026-02-28T22:30:00.000Z'),
      }),
      buildSession({
        id: 2,
        date: new Date('2026-03-31T22:30:00.000Z'),
      }),
    ],
  });

  const stats = await service.getCalendarStats(null, {
    month: '2026-03-01',
    scope: 'global',
    timeZone: 'Europe/Kyiv',
  });

  assert.deepEqual(Object.keys(stats), ['2026-03-01']);
  assert.equal(stats['2026-03-01'].count, 1);
});

test('calendar stats apply dateFrom/dateTo against the local calendar day', async () => {
  const service = buildService({
    sessions: [
      buildSession({
        id: 1,
        date: new Date('2026-03-09T22:30:00.000Z'),
      }),
    ],
  });

  const stats = await service.getCalendarStats(null, {
    month: '2026-03-01',
    scope: 'search',
    timeZone: 'Europe/Kyiv',
    filters: {
      dateFrom: '2026-03-10',
      dateTo: '2026-03-10',
    },
  });

  assert.deepEqual(Object.keys(stats), ['2026-03-10']);
  assert.equal(stats['2026-03-10'].count, 1);
});
