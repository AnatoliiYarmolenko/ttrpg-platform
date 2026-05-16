const assert = require('node:assert/strict');
const test = require('node:test');
const { 
  buildChatAccessContext, 
  CHAT_SCOPES 
} = require('../../src/domain/chat/chat-access.context');

test('buildChatAccessContext: builds context for campaign chat', () => {
  const chat = {
    id: 10,
    campaignId: 1,
    campaign: {
      id: 1,
      ownerId: 5,
      status: 'ACTIVE',
      members: [{ userId: 7 }]
    }
  };

  const context = buildChatAccessContext({ chat, userId: 7 });

  assert.equal(context.scope, CHAT_SCOPES.CAMPAIGN);
  assert.equal(context.isCampaignMember, true);
  assert.equal(context.isCampaignOwner, false);
  assert.equal(context.readonly, false);
});

test('buildChatAccessContext: sets readonly for finished campaign', () => {
  const chat = {
    campaignId: 1,
    campaign: {
      id: 1,
      ownerId: 5,
      status: 'FINISHED',
      members: []
    }
  };

  const context = buildChatAccessContext({ chat, userId: 5 });
  assert.equal(context.readonly, true);
});

test('buildChatAccessContext: builds context for session chat', () => {
  const chat = {
    id: 20,
    sessionId: 2,
    session: {
      id: 2,
      status: 'ACTIVE',
      campaign: { id: 1, ownerId: 5, status: 'ACTIVE' },
      participants: [
        { userId: 7, status: 'CONFIRMED' },
        { userId: 8, status: 'PENDING' }
      ]
    }
  };

  const contextConfirmed = buildChatAccessContext({ chat, userId: 7 });
  assert.equal(contextConfirmed.scope, CHAT_SCOPES.SESSION);
  assert.equal(contextConfirmed.isSessionParticipant, true);

  const contextPending = buildChatAccessContext({ chat, userId: 8 });
  assert.equal(contextPending.isSessionParticipant, false);
  assert.equal(contextPending.isPendingParticipant, true);

  const contextOwner = buildChatAccessContext({ chat, userId: 5 });
  assert.equal(contextOwner.isCampaignOwnerOverride, true);
});

test('buildChatAccessContext: handles missing user', () => {
  const chat = { campaignId: 1 };
  const context = buildChatAccessContext({ chat, userId: null });
  assert.equal(context.userId, null);
  assert.equal(context.isCampaignOwner, false);
});
