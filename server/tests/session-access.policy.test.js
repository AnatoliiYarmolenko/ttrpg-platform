const test = require('node:test');
const assert = require('node:assert/strict');

const { getSessionViewerCapabilities } = require('../src/domain/session/session.policy');

test('campaign member can open private campaign session with MEMBERS_ONLY join mode', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'PRIVATE',
    isCampaignSession: true,
    isCampaignMember: true,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 42,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, true);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.joinMode, 'MEMBERS_ONLY');
  assert.equal(capabilities.canManage, false);
  assert.equal(capabilities.canManageParticipants, false);
});

test('outsider cannot open private campaign session', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'PRIVATE',
    isCampaignSession: true,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 43,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.joinMode, 'MEMBERS_ONLY');
});

test('outsider can open public one-shot session with OPEN join mode', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'PUBLIC',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 44,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, true);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.joinMode, 'OPEN');
});
