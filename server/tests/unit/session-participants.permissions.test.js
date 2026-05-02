const test = require('node:test');
const assert = require('node:assert/strict');

const createSessionParticipantsService = require('../../src/services/session/session-participants.service');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  SESSION_PARTICIPANT_STATUS_INVALID: 'SESSION_PARTICIPANT_STATUS_INVALID',
  SESSION_PARTICIPANT_MANAGEMENT_UNAVAILABLE: 'SESSION_PARTICIPANT_MANAGEMENT_UNAVAILABLE',
  SESSION_PARTICIPANT_DECLINE_PENDING_ONLY: 'SESSION_PARTICIPANT_DECLINE_PENDING_ONLY',
  SESSION_GM_REQUESTS_OWNER_ONLY: 'SESSION_GM_REQUESTS_OWNER_ONLY',
  SESSION_PARTICIPANTS_MANAGE_OWNER_OR_CONFIRMED_GM_ONLY: 'SESSION_PARTICIPANTS_MANAGE_OWNER_OR_CONFIRMED_GM_ONLY',
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
        return { count: 0 };
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

  return { service, state };
}

test('non-owner cannot confirm GM application', async () => {
  const { service, state } = buildModerationContext({
    ownerId: 1,
    participants: [
      { id: 31, sessionId: 100, userId: 41, role: 'GM', status: 'PENDING' },
    ],
  });

  await assert.rejects(
    () => service.updateParticipantStatus(100, 31, 2, 'CONFIRMED'),
    (error) => error instanceof AppError && error.code === ERROR_CODES.SESSION_GM_REQUESTS_OWNER_ONLY
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
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SESSION_PARTICIPANTS_MANAGE_OWNER_OR_CONFIRMED_GM_ONLY
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
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SESSION_PARTICIPANT_MANAGEMENT_UNAVAILABLE
  );

  assert.equal(state.updateCalls.length, 0);
  assert.equal(state.deleteCalls.length, 0);
});
