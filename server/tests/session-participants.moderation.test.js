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
  SESSION_OWNER_ONLY: 'SESSION_OWNER_ONLY',
  SESSION_GM_ONLY: 'SESSION_GM_ONLY',
};

function buildSession() {
  return {
    id: 100,
    ownerId: 1,
    status: 'PLANNED',
    campaign: null,
    participants: [],
  };
}

function buildModerationContext(options = {}) {
  const state = {
    deleteCalls: [],
    deleteManyCalls: [],
    updateCalls: [],
  };

  const session = options.session || buildSession();
  const participantsById = new Map(
    (options.participants || []).map((participant) => [participant.id, { ...participant }])
  );

  const prisma = {
    sessionParticipant: {
      findUnique: async ({ where }) => {
        const participant = participantsById.get(where.id);
        return participant ? { ...participant } : null;
      },
      delete: async ({ where }) => {
        state.deleteCalls.push(where.id);
        participantsById.delete(where.id);
        return { id: where.id };
      },
      deleteMany: async ({ where }) => {
        state.deleteManyCalls.push(where);

        let count = 0;
        for (const [id, participant] of participantsById.entries()) {
          const sameSession = participant.sessionId === where.sessionId;
          const sameRole = participant.role === where.role;
          const sameStatus = participant.status === where.status;
          const notTarget = participant.id !== where.NOT?.id;

          if (sameSession && sameRole && sameStatus && notTarget) {
            participantsById.delete(id);
            count += 1;
          }
        }

        return { count };
      },
      update: async ({ where, data }) => {
        const existing = participantsById.get(where.id);
        const updated = {
          ...existing,
          ...data,
        };

        participantsById.set(where.id, updated);
        state.updateCalls.push({ where, data });

        return {
          ...updated,
          user: {
            id: updated.userId,
            username: `user_${updated.userId}`,
            displayName: null,
            avatarUrl: null,
          },
        };
      },
    },
    $transaction: async (operations) => Promise.all(operations),
  };

  const service = createSessionParticipantsService({
    prisma,
    AppError,
    ERROR_CODES,
    getSessionById: async () => session,
    resolveSessionContext: async () => session,
    assertNoSessionTimeConflict: async () => true,
    permissionHelpers: {
      _getConfirmedGm: () => null,
      _isSessionOwner: (_session, userId) => userId === (options.ownerId ?? 1),
      _isCampaignOwnerOverride: () => false,
      _canManageParticipants: () => options.canManageParticipants ?? true,
    },
  });

  return { service, state, participantsById };
}

test('declining a pending player application removes participant record', async () => {
  const { service, state, participantsById } = buildModerationContext({
    participants: [
      { id: 11, sessionId: 100, userId: 22, role: 'PLAYER', status: 'PENDING' },
    ],
    canManageParticipants: true,
  });

  const result = await service.updateParticipantStatus(100, 11, 5, 'DECLINED');

  assert.equal(result.id, 11);
  assert.equal(result.status, 'DECLINED');
  assert.equal(state.deleteCalls.length, 1);
  assert.equal(state.deleteCalls[0], 11);
  assert.equal(state.updateCalls.length, 0);
  assert.equal(participantsById.has(11), false);
});

test('declining non-pending participant is rejected', async () => {
  const { service, state } = buildModerationContext({
    participants: [
      { id: 12, sessionId: 100, userId: 23, role: 'PLAYER', status: 'CONFIRMED' },
    ],
    canManageParticipants: true,
  });

  await assert.rejects(
    () => service.updateParticipantStatus(100, 12, 5, 'DECLINED'),
    (error) => error instanceof AppError && error.code === ERROR_CODES.VALIDATION_FAILED
  );

  assert.equal(state.deleteCalls.length, 0);
  assert.equal(state.updateCalls.length, 0);
});

test('confirming one GM application removes other pending GM applications', async () => {
  const { service, state, participantsById } = buildModerationContext({
    ownerId: 1,
    participants: [
      { id: 21, sessionId: 100, userId: 31, role: 'GM', status: 'PENDING' },
      { id: 22, sessionId: 100, userId: 32, role: 'GM', status: 'PENDING' },
      { id: 23, sessionId: 100, userId: 33, role: 'PLAYER', status: 'PENDING' },
    ],
  });

  const result = await service.updateParticipantStatus(100, 21, 1, 'CONFIRMED');

  assert.equal(result.id, 21);
  assert.equal(result.status, 'CONFIRMED');
  assert.equal(state.updateCalls.length, 1);
  assert.equal(state.deleteManyCalls.length, 1);
  assert.equal(participantsById.has(21), true);
  assert.equal(participantsById.has(22), false);
  assert.equal(participantsById.has(23), true);
});

test('non-owner cannot confirm GM application', async () => {
  const { service, state } = buildModerationContext({
    ownerId: 1,
    participants: [
      { id: 31, sessionId: 100, userId: 41, role: 'GM', status: 'PENDING' },
    ],
  });

  await assert.rejects(
    () => service.updateParticipantStatus(100, 31, 2, 'CONFIRMED'),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SESSION_OWNER_ONLY
  );

  assert.equal(state.updateCalls.length, 0);
  assert.equal(state.deleteManyCalls.length, 0);
});

test('non-manager cannot confirm player application', async () => {
  const { service, state } = buildModerationContext({
    ownerId: 1,
    canManageParticipants: false,
    participants: [
      { id: 32, sessionId: 100, userId: 42, role: 'PLAYER', status: 'PENDING' },
    ],
  });

  await assert.rejects(
    () => service.updateParticipantStatus(100, 32, 2, 'CONFIRMED'),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SESSION_GM_ONLY
  );

  assert.equal(state.updateCalls.length, 0);
});

test('cannot moderate participants in FINISHED session', async () => {
  const { service, state } = buildModerationContext({
    session: {
      id: 100,
      ownerId: 1,
      status: 'FINISHED',
      campaign: null,
      participants: [],
    },
    participants: [
      { id: 33, sessionId: 100, userId: 43, role: 'PLAYER', status: 'PENDING' },
    ],
  });

  await assert.rejects(
    () => service.updateParticipantStatus(100, 33, 1, 'CONFIRMED'),
    (error) => error instanceof AppError && error.code === ERROR_CODES.VALIDATION_FAILED
  );

  assert.equal(state.updateCalls.length, 0);
  assert.equal(state.deleteCalls.length, 0);
});
