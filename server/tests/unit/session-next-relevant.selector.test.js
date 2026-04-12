const test = require('node:test');
const assert = require('node:assert/strict');

const {
  selectNextRelevantSession,
} = require('../../src/services/session/session-next-relevant.selector');

function makeSession(overrides = {}) {
  return {
    id: 1,
    title: 'Test Session',
    status: 'PLANNED',
    myStatus: 'CONFIRMED',
    startAt: '2026-04-12T12:00:00.000Z',
    ...overrides,
  };
}

test('excludes CANCELED and FINISHED sessions', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 1, status: 'CANCELED', startAt: '2026-04-12T11:00:00.000Z' }),
    makeSession({ id: 2, status: 'FINISHED', startAt: '2026-04-12T11:00:00.000Z' }),
    makeSession({ id: 3, status: 'PLANNED', startAt: '2026-04-12T12:00:00.000Z' }),
  ], { now });

  assert.equal(selected?.id, 3);
});

test('keeps only sessions with myStatus CONFIRMED', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 1, status: 'ACTIVE', myStatus: 'PENDING', startAt: '2026-04-12T09:00:00.000Z' }),
    makeSession({ id: 2, status: 'PLANNED', myStatus: 'DECLINED', startAt: '2026-04-12T11:00:00.000Z' }),
    makeSession({ id: 3, status: 'PLANNED', myStatus: 'CONFIRMED', startAt: '2026-04-12T12:00:00.000Z' }),
  ], { now });

  assert.equal(selected?.id, 3);
});

test('ACTIVE has priority over PLANNED when ACTIVE is valid by anti-zombie rule', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 10, status: 'PLANNED', startAt: '2026-04-12T10:15:00.000Z' }),
    makeSession({ id: 11, status: 'ACTIVE', startAt: '2026-04-12T09:30:00.000Z' }),
  ], { now, activeMaxAgeHours: 24 });

  assert.equal(selected?.id, 11);
});

test('when multiple ACTIVE sessions exist, selector picks earliest startAt then minimal id', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 71, status: 'ACTIVE', startAt: '2026-04-12T09:30:00.000Z' }),
    makeSession({ id: 70, status: 'ACTIVE', startAt: '2026-04-12T09:30:00.000Z' }),
    makeSession({ id: 72, status: 'ACTIVE', startAt: '2026-04-12T09:20:00.000Z' }),
  ], { now });

  assert.equal(selected?.id, 72);
});

test('zombie ACTIVE is ignored and selector falls back to nearest future PLANNED', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 20, status: 'ACTIVE', startAt: '2026-04-10T08:00:00.000Z' }),
    makeSession({ id: 21, status: 'PLANNED', startAt: '2026-04-12T10:30:00.000Z' }),
    makeSession({ id: 22, status: 'PLANNED', startAt: '2026-04-12T12:00:00.000Z' }),
  ], { now, activeMaxAgeHours: 24 });

  assert.equal(selected?.id, 21);
});

test('invalid/missing startAt is excluded for ACTIVE and PLANNED', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 30, status: 'ACTIVE', startAt: null }),
    makeSession({ id: 31, status: 'PLANNED', startAt: 'not-a-date' }),
  ], { now });

  assert.equal(selected, null);
});

test('tie-break is deterministic: earliest startAt, then minimal id', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 99, status: 'PLANNED', startAt: '2026-04-12T11:00:00.000Z' }),
    makeSession({ id: 42, status: 'PLANNED', startAt: '2026-04-12T11:00:00.000Z' }),
    makeSession({ id: 100, status: 'PLANNED', startAt: '2026-04-12T10:30:00.000Z' }),
  ], { now });

  assert.equal(selected?.id, 100);

  const selectedWithEqualDate = selectNextRelevantSession([
    makeSession({ id: 99, status: 'PLANNED', startAt: '2026-04-12T11:00:00.000Z' }),
    makeSession({ id: 42, status: 'PLANNED', startAt: '2026-04-12T11:00:00.000Z' }),
  ], { now });

  assert.equal(selectedWithEqualDate?.id, 42);
});

test('planned tolerance window allows near-past PLANNED session', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 50, status: 'PLANNED', startAt: '2026-04-12T09:58:30.000Z' }),
    makeSession({ id: 51, status: 'PLANNED', startAt: '2026-04-12T10:10:00.000Z' }),
  ], { now, plannedToleranceMinutes: 2 });

  assert.equal(selected?.id, 50);
});

test('past PLANNED outside tolerance window is excluded', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 80, status: 'PLANNED', startAt: '2026-04-12T09:50:00.000Z' }),
    makeSession({ id: 81, status: 'PLANNED', startAt: '2026-04-12T10:12:00.000Z' }),
  ], { now, plannedToleranceMinutes: 2 });

  assert.equal(selected?.id, 81);
});

test('uses UTC-safe ISO dates and supports legacy date field', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    {
      id: 60,
      status: 'PLANNED',
      myStatus: 'CONFIRMED',
      date: '2026-04-12T10:01:00.000Z',
    },
    {
      id: 61,
      status: 'PLANNED',
      myStatus: 'CONFIRMED',
      date: '2026-04-12T10:05:00.000Z',
    },
  ], { now });

  assert.equal(selected?.id, 60);
});

test('handles timezone drift with offset timestamps and planned tolerance window', () => {
  const now = '2026-04-12T10:00:00.000Z';

  const selected = selectNextRelevantSession([
    makeSession({ id: 90, status: 'PLANNED', startAt: '2026-04-12T12:01:00+02:00' }),
    makeSession({ id: 91, status: 'PLANNED', startAt: '2026-04-12T11:59:30+02:00' }),
  ], { now, plannedToleranceMinutes: 2 });

  assert.equal(selected?.id, 91);
});
