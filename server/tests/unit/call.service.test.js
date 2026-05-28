const { test, describe, beforeEach, mock } = require('node:test');
const assert = require('node:assert');
const { CallService, broadcastCallEvent } = require('../../src/call/call.service');
const { CALL_STATES } = require('../../src/call/call-events');
const mediasoupLib = require('../../src/lib/mediasoup');

describe('CallService', () => {
  let callService;
  let mockWorker;
  let mockRouter;

  beforeEach(() => {
    mockRouter = {
      rtpCapabilities: { codecs: [] },
      close: mock.fn()
    };
    
    mockWorker = {
      createRouter: mock.fn(async () => mockRouter)
    };

    mock.method(mediasoupLib, 'getWorker', () => mockWorker);

    // Використовуємо реальний room manager, бо це лише in-memory стан
    callService = new CallService();
    const { callRoomManager } = require('../../src/call/call-room.manager');
    callRoomManager.rooms.clear(); // Очищаємо всі кімнати
  });

  test('startCall successfully starts a call', async () => {
    const room = await callService.startCall('session-1');
    
    assert.strictEqual(room.callState, CALL_STATES.ACTIVE);
    assert.strictEqual(room.router, mockRouter);
    assert.strictEqual(mockWorker.createRouter.mock.calls.length, 1);
  });

  test('startCall throws if already active', async () => {
    await callService.startCall('session-1');
    
    await assert.rejects(
      async () => await callService.startCall('session-1'),
      /CALL_ALREADY_ACTIVE/
    );
  });

  test('joinCall allows user to join active call', async () => {
    await callService.startCall('session-1');
    
    const mockSocket = { id: 'sock-1', send: mock.fn(), readyState: 1 };
    
    const result = callService.joinCall('session-1', 'user-1', mockSocket);
    
    assert.strictEqual(result.callState, CALL_STATES.ACTIVE);
    assert.strictEqual(result.peers.length, 1);
    assert.strictEqual(result.peers[0].userId, 'user-1');
  });

  test('joinCall throws if call not active', () => {
    const mockSocket = { id: 'sock-1', send: mock.fn() };
    
    assert.throws(
      () => callService.joinCall('session-1', 'user-1', mockSocket),
      /CALL_NOT_ACTIVE/
    );
  });

  test('endCall changes state and destroys room', async () => {
    await callService.startCall('session-1');
    
    callService.endCall('session-1');
    
    const { callRoomManager } = require('../../src/call/call-room.manager');
    const room = callRoomManager.getRoomIfExists('session-1');
    assert.strictEqual(room.callState, CALL_STATES.ENDED);
    assert.strictEqual(mockRouter.close.mock.calls.length, 1);
  });

  test('broadcastCallEvent sends message to all sockets except excludeSocket', () => {
    const { callRoomManager } = require('../../src/call/call-room.manager');
    const room = callRoomManager.getRoom('session-1');
    
    const socket1 = { send: mock.fn(), readyState: 1 };
    const socket2 = { send: mock.fn(), readyState: 1 };
    const socket3 = { send: mock.fn(), readyState: 1 }; // Excluded
    
    room.sockets.add(socket1);
    room.sockets.add(socket2);
    room.sockets.add(socket3);
    
    broadcastCallEvent(room, 'call:test-event', { data: 123 }, socket3);
    
    assert.strictEqual(socket1.send.mock.calls.length, 1);
    assert.strictEqual(socket2.send.mock.calls.length, 1);
    assert.strictEqual(socket3.send.mock.calls.length, 0); // Excluded socket shouldn't receive it
    
    const sentData = JSON.parse(socket1.send.mock.calls[0].arguments[0]);
    assert.strictEqual(sentData.type, 'call:event');
    assert.strictEqual(sentData.event, 'call:test-event');
    assert.deepStrictEqual(sentData.payload, { data: 123 });
  });
});
