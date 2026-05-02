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

function buildService() {
  const state = {
    lastFindManyArgs: null,
  };

  const prisma = {
    user: {
      findUnique: async () => ({ timezone: null }),
    },
    session: {
      findMany: async (args) => {
        state.lastFindManyArgs = args;
        return [];
      },
    },
  };

  return {
    service: createSessionCalendarService({
      prisma,
      AppError,
      ERROR_CODES,
    }),
    state,
  };
}

test('day-filtered query combines system and search text filters via AND clauses', async () => {
  const { service, state } = buildService();

  await service.getSessionsByDayFiltered(
    null,
    '2026-03-15',
    'search',
    {
      system: 'D&D',
      searchQuery: 'Dragon',
    },
    'Europe/Kyiv'
  );

  assert.ok(state.lastFindManyArgs?.where);
  assert.equal(state.lastFindManyArgs.where.AND.length, 3);
  assert.deepEqual(state.lastFindManyArgs.where.AND[1], {
    OR: [
      { system: { contains: 'D&D', mode: 'insensitive' } },
      {
        campaign: {
          system: { contains: 'D&D', mode: 'insensitive' },
        },
      },
    ],
  });
  assert.deepEqual(state.lastFindManyArgs.where.AND[2], {
    OR: [
      { title: { contains: 'Dragon', mode: 'insensitive' } },
      { description: { contains: 'Dragon', mode: 'insensitive' } },
    ],
  });
});
