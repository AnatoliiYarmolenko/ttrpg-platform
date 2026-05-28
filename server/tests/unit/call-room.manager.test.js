const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const { CallRoomManager } = require('../../src/call/call-room.manager');
const { CALL_STATES } = require('../../src/call/call-events');

describe('CallRoomManager', () => {
  let manager;

  beforeEach(() => {
    manager = new CallRoomManager();
  });

  test('getRoom creates a new room if it does not exist', () => {
    const room = manager.getRoom('session-1');
    assert.strictEqual(room.sessionId, 'session-1');
    assert.strictEqual(room.callState, CALL_STATES.IDLE);
    assert.ok(manager.hasRoom('session-1'));
  });

  test('addPeer adds a new peer to the room', () => {
    manager.addPeer('session-1', 'user-1', 'socket-1');
    const peer = manager.getPeer('session-1', 'socket-1');
    
    assert.ok(peer);
    assert.strictEqual(peer.userId, 'user-1');
    assert.strictEqual(peer.socketId, 'socket-1');
  });

  test('allows multiple peers with the same userId but different socketIds', () => {
    manager.addPeer('session-1', 'user-1', 'socket-1');
    manager.addPeer('session-1', 'user-1', 'socket-2');
    
    const peer1 = manager.getPeer('session-1', 'socket-1');
    const peer2 = manager.getPeer('session-1', 'socket-2');
    
    assert.ok(peer1);
    assert.ok(peer2);
    assert.strictEqual(peer1.socketId, 'socket-1');
    assert.strictEqual(peer2.socketId, 'socket-2');
    assert.notStrictEqual(peer1, peer2);
  });

  test('removePeer removes peer and calls closeAll', () => {
    const peer = manager.addPeer('session-1', 'user-1', 'socket-1');
    let closeAllCalled = false;
    peer.closeAll = () => { closeAllCalled = true; };

    manager.removePeer('session-1', 'socket-1');
    
    assert.strictEqual(manager.getPeer('session-1', 'socket-1'), null);
    assert.strictEqual(closeAllCalled, true);
  });

  test('destroyRoom cleans up resources and marks room ended', () => {
    const room = manager.getRoom('session-1');
    manager.addPeer('session-1', 'user-1', 'socket-1');
    
    let routerClosed = false;
    room.router = { close: () => { routerClosed = true; } };
    
    manager.destroyRoom('session-1');
    
    assert.strictEqual(routerClosed, true);
    assert.strictEqual(room.callState, CALL_STATES.ENDED);
    assert.strictEqual(manager.hasRoom('session-1'), true);
  });

  describe('Empty Room Cleanup', () => {
    const { before, after } = require('node:test');

    before(() => {
      test.mock.timers.enable({ apis: ['setTimeout'] });
    });

    after(() => {
      test.mock.timers.reset();
    });

    test('deletes inactive room immediately when empty', () => {
      manager.addSocket('session-1', 'fake-socket-1');
      assert.ok(manager.hasRoom('session-1'));

      manager.removeSocket('session-1', 'fake-socket-1');
      
      assert.strictEqual(manager.hasRoom('session-1'), false);
    });

    test('starts grace period timeout for ACTIVE room when empty', () => {
      const room = manager.getRoom('session-1');
      room.callState = CALL_STATES.ACTIVE;
      
      manager.addSocket('session-1', 'fake-socket-1');
      manager.removeSocket('session-1', 'fake-socket-1');
      
      // The room should still exist because it's ACTIVE
      assert.strictEqual(manager.hasRoom('session-1'), true);
      const roomAfterRemove = manager.getRoom('session-1');
      assert.ok(roomAfterRemove.emptyTimeout);
      
      // Advance timers by 3 minutes
      test.mock.timers.tick(3 * 60 * 1000);
      
      // The room should now be deleted
      assert.strictEqual(manager.hasRoom('session-1'), false);
    });

    test('clears grace period timeout if a socket reconnects', () => {
      const room = manager.getRoom('session-1');
      room.callState = CALL_STATES.ACTIVE;
      
      manager.addSocket('session-1', 'fake-socket-1');
      manager.removeSocket('session-1', 'fake-socket-1');
      
      assert.ok(room.emptyTimeout);
      
      // Reconnect within grace period
      manager.addSocket('session-1', 'fake-socket-2');
      
      assert.strictEqual(room.emptyTimeout, null);
      
      // Advance timers by 3 minutes
      test.mock.timers.tick(3 * 60 * 1000);
      
      // The room should still exist
      assert.strictEqual(manager.hasRoom('session-1'), true);
    });
  });
});
