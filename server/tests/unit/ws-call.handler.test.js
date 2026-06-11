const { test, describe, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { createCallHandler, parseIncomingMessage } = require(path.resolve(
  __dirname,
  '../../src/ws/ws-call.handler'
));
const { callService } = require('../../src/call/call.service');
const { callRoomManager } = require('../../src/call/call-room.manager');
const sessionService = require('../../src/services/session.service');
const rateLimitService = require('../../src/services/rate-limit.service');
const { ERROR_CODES } = require('../../src/constants/errors');

describe('WS Call Handler', () => {
  describe('parseIncomingMessage', () => {
    test('parses valid JSON string', () => {
      const result = parseIncomingMessage('{"type":"test","payload":{"foo":"bar"}}');
      assert.strictEqual(result.type, 'test');
      assert.deepStrictEqual(result.payload, { foo: 'bar' });
    });

    test('throws on invalid format', () => {
      assert.throws(() => parseIncomingMessage('not json'), { code: ERROR_CODES.VALIDATION_FAILED });
    });
  });

  describe('createCallHandler', () => {
    let mockSocket;
    let handler;

    beforeEach(() => {
      mockSocket = {
        user: { id: 'user-1' },
        on: mock.fn(),
        send: mock.fn(),
        readyState: 1 // ВІДКРИТО
      };
      handler = createCallHandler();
      mock.method(rateLimitService, 'checkRateLimit', async () => true);
    });

    afterEach(() => {
      if (rateLimitService.checkRateLimit.mock) {
        rateLimitService.checkRateLimit.mock.restore();
      }
    });

    test('attaches message and close listeners', () => {
      handler(mockSocket);
      assert.strictEqual(mockSocket.on.mock.calls.length, 2);
      assert.strictEqual(mockSocket.on.mock.calls[0].arguments[0], 'message');
      assert.strictEqual(mockSocket.on.mock.calls[1].arguments[0], 'close');
    });

    test('handles call:join with permissions', async () => {
      mock.method(sessionService, 'getSessionPageById', async () => ({
        actions: { canJoinCall: true }
      }));
      mock.method(callService, 'joinCall', () => ({ callState: 'ACTIVE', peers: [] }));
      handler(mockSocket);
      
      const messageHandler = mockSocket.on.mock.calls.find(c => c.arguments[0] === 'message').arguments[1];
      
      await messageHandler(JSON.stringify({ type: 'call:join', sessionId: 'session-1' }));
      
      assert.strictEqual(sessionService.getSessionPageById.mock.calls.length, 1);
      assert.strictEqual(callService.joinCall.mock.calls.length, 1);
      
      const sendArgs = JSON.parse(mockSocket.send.mock.calls[0].arguments[0]);
      assert.strictEqual(sendArgs.type, 'call:joined');
      
      sessionService.getSessionPageById.mock.restore();
      callService.joinCall.mock.restore();
    });

    test('rejects call:start without permissions', async () => {
      mock.method(sessionService, 'getSessionPageById', async () => ({
        actions: { canStartCall: false }
      }));
      handler(mockSocket);
      
      const messageHandler = mockSocket.on.mock.calls.find(c => c.arguments[0] === 'message').arguments[1];
      await messageHandler(JSON.stringify({ type: 'call:start', sessionId: 'session-1' }));
      
      const sendArgs = JSON.parse(mockSocket.send.mock.calls[0].arguments[0]);
      assert.strictEqual(sendArgs.type, 'call:error');
      assert.strictEqual(sendArgs.code, ERROR_CODES.CALL_START_FORBIDDEN);
      
      sessionService.getSessionPageById.mock.restore();
    });

    test('handles call:getCallState with permissions', async () => {
      mock.method(sessionService, 'getSessionPageById', async () => ({
        viewer: { isSessionOwner: true, isParticipant: false }
      }));
      mock.method(callService, 'getCallState', () => ({ callState: 'IDLE', peers: [] }));
      handler(mockSocket);
      
      const messageHandler = mockSocket.on.mock.calls.find(c => c.arguments[0] === 'message').arguments[1];
      await messageHandler(JSON.stringify({ type: 'call:getCallState', sessionId: 'session-1' }));
      
      const sendArgs = JSON.parse(mockSocket.send.mock.calls[0].arguments[0]);
      assert.strictEqual(sendArgs.type, 'call:callState');
      assert.strictEqual(sendArgs.callState, 'IDLE');
      
      sessionService.getSessionPageById.mock.restore();
      callService.getCallState.mock.restore();
    });
  });
});
