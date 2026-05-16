const assert = require('node:assert/strict');
const test = require('node:test');
const { 
  canReadChat, 
  canWriteChat, 
  getChatCapabilities 
} = require('../../src/domain/chat/chat.policy');
const { CHAT_SCOPES } = require('../../src/domain/chat/chat-access.context');

test('canReadChat: allows campaign owner to read campaign chat', () => {
  const context = {
    userId: 1,
    scope: CHAT_SCOPES.CAMPAIGN,
    isCampaignOwner: true
  };
  assert.equal(canReadChat(context), true);
});

test('canReadChat: allows campaign member to read campaign chat', () => {
  const context = {
    userId: 2,
    scope: CHAT_SCOPES.CAMPAIGN,
    isCampaignMember: true
  };
  assert.equal(canReadChat(context), true);
});

test('canReadChat: denies outsider from reading campaign chat', () => {
  const context = {
    userId: 3,
    scope: CHAT_SCOPES.CAMPAIGN,
    isCampaignMember: false,
    isCampaignOwner: false
  };
  assert.equal(canReadChat(context), false);
});

test('canReadChat: allows session participant to read session chat', () => {
  const context = {
    userId: 1,
    scope: CHAT_SCOPES.SESSION,
    isSessionParticipant: true
  };
  assert.equal(canReadChat(context), true);
});

test('canReadChat: allows campaign owner to read session chat (override)', () => {
  const context = {
    userId: 5,
    scope: CHAT_SCOPES.SESSION,
    isCampaignOwnerOverride: true
  };
  assert.equal(canReadChat(context), true);
});

test('canWriteChat: denies writing if chat is in readonly mode', () => {
  const context = {
    userId: 1,
    scope: CHAT_SCOPES.CAMPAIGN,
    isCampaignOwner: true,
    readonly: true
  };
  assert.equal(canWriteChat(context), false);
});

test('canWriteChat: allows writing if has read access and not readonly', () => {
  const context = {
    userId: 1,
    scope: CHAT_SCOPES.CAMPAIGN,
    isCampaignOwner: true,
    readonly: false
  };
  assert.equal(canWriteChat(context), true);
});

test('getChatCapabilities: returns full set of permissions', () => {
  const context = {
    userId: 1,
    scope: CHAT_SCOPES.CAMPAIGN,
    isCampaignOwner: true,
    readonly: false
  };
  const caps = getChatCapabilities(context);
  assert.deepEqual(caps, {
    canRead: true,
    canWrite: true,
    canModerate: false,
    readonly: false
  });
});

test('canReadChat: returns false for unauthorized request', () => {
  assert.equal(canReadChat({ userId: null }), false);
  assert.equal(canReadChat({}), false);
});
