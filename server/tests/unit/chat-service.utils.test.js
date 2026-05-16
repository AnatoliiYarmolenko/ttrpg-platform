const assert = require('node:assert/strict');
const test = require('node:test');
const { 
  parseCursor, 
  buildCursor, 
  mapChatMessage 
} = require('../../src/services/chat.service');

test('buildCursor: creates a valid cursor string', () => {
  const message = {
    id: 123,
    createdAt: new Date('2026-05-15T10:00:00.000Z')
  };
  const cursor = buildCursor(message);
  assert.equal(cursor, '2026-05-15T10:00:00.000Z:123');
});

test('parseCursor: correctly parses a valid cursor', () => {
  const cursor = '2026-05-15T10:00:00.000Z:123';
  const result = parseCursor(cursor);
  
  assert.equal(result.id, 123);
  assert.equal(result.createdAt.toISOString(), '2026-05-15T10:00:00.000Z');
});

test('parseCursor: throws error on invalid format', () => {
  assert.throws(() => parseCursor('invalid'), {
    message: /Невірний формат cursor/
  });
  
  assert.throws(() => parseCursor('2026-05-15:abc'), {
    message: /cursor id повинен бути позитивним числом/
  });

  assert.throws(() => parseCursor('not-a-date:123'), {
    message: /Невірний формат cursor/
  });
});

test('mapChatMessage: transforms message object for API', () => {
  const dbMessage = {
    id: 1,
    chatId: 10,
    type: 'USER',
    content: 'Hello',
    authorId: 5,
    author: { username: 'test' },
    createdAt: new Date(),
    extraField: 'should be removed'
  };

  const result = mapChatMessage(dbMessage);

  assert.equal(result.id, 1);
  assert.equal(result.content, 'Hello');
  assert.equal(result.author.username, 'test');
  assert.equal(result.extraField, undefined);
});

test('mapChatMessage: handles missing author', () => {
  const result = mapChatMessage({ id: 1, author: null });
  assert.equal(result.author, null);
});
