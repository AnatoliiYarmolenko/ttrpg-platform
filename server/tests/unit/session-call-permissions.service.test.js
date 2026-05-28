const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const permissionsService = require(path.resolve(
  __dirname,
  '../../src/services/session/session-call-permissions.service'
));

describe('Session Call Permissions Service', () => {
  describe('canStartCall', () => {
    test('should return false if session is not active', () => {
      const session = { status: 'PLANNED' };
      assert.strictEqual(permissionsService.canStartCall({ session, isOwner: true }), false);
    });

    test('should return true for owner in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canStartCall({ session, isOwner: true, isConfirmedGm: false }), true);
    });

    test('should return true for confirmed GM in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canStartCall({ session, isOwner: false, isConfirmedGm: true }), true);
    });

    test('should return false for regular participant in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canStartCall({ session, isOwner: false, isConfirmedGm: false }), false);
    });
  });

  describe('canEndCall', () => {
    test('should return false if session is not active', () => {
      const session = { status: 'PLANNED' };
      assert.strictEqual(permissionsService.canEndCall({ session, isOwner: true }), false);
    });

    test('should return true for owner in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canEndCall({ session, isOwner: true, isConfirmedGm: false }), true);
    });

    test('should return true for confirmed GM in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canEndCall({ session, isOwner: false, isConfirmedGm: true }), true);
    });

    test('should return false for regular participant in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canEndCall({ session, isOwner: false, isConfirmedGm: false }), false);
    });
  });

  describe('canJoinCall', () => {
    test('should return false if session is not active', () => {
      const session = { status: 'PLANNED' };
      assert.strictEqual(permissionsService.canJoinCall({ session, isOwner: true }), false);
    });

    test('should return true for owner in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canJoinCall({ session, isOwner: true }), true);
    });

    test('should return true for confirmed GM in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canJoinCall({ session, isConfirmedGm: true }), true);
    });

    test('should return true for regular participant in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(permissionsService.canJoinCall({ session, isParticipant: true }), true);
    });

    test('should return false for non-participant in active session', () => {
      const session = { status: 'ACTIVE' };
      assert.strictEqual(
        permissionsService.canJoinCall({
          session,
          isOwner: false,
          isConfirmedGm: false,
          isParticipant: false,
        }),
        false
      );
    });
  });
});
