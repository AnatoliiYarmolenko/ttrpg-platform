const test = require('node:test');
const assert = require('node:assert/strict');

const { getSessionViewerCapabilities } = require('../../src/domain/session/session.policy');

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

test('returns default capabilities for null context', () => {
  const capabilities = getSessionViewerCapabilities(null);

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.canManage, false);
  assert.equal(capabilities.canManageParticipants, false);
  assert.equal(capabilities.joinMode, 'NOT_APPLICABLE');
  assert.equal(capabilities.requiresShareTokenForOutsider, false);
});

test('returns default capabilities for undefined context', () => {
  const capabilities = getSessionViewerCapabilities(undefined);

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.canManage, false);
  assert.equal(capabilities.canManageParticipants, false);
  assert.equal(capabilities.joinMode, 'NOT_APPLICABLE');
  assert.equal(capabilities.requiresShareTokenForOutsider, false);
});

test('handles null visibility gracefully', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: null,
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 45,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.joinMode, 'NOT_APPLICABLE');
});

test('handles undefined visibility gracefully', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: undefined,
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 46,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.joinMode, 'NOT_APPLICABLE');
});

test('handles invalid visibility enum value', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'INVALID_VISIBILITY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 47,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.joinMode, 'NOT_APPLICABLE');
});

test('owner can manage session regardless of other flags', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'PUBLIC',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: true,
    isOwner: true,
    isConfirmedGm: false,
    userId: 48,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, true);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.canManage, true);
  assert.equal(capabilities.canManageParticipants, true);
});

test('confirmed GM can manage session and participants', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'PUBLIC',
    isCampaignSession: true,
    isCampaignMember: true,
    isParticipant: true,
    isOwner: false,
    isConfirmedGm: true,
    userId: 49,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, true);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.canManage, true);
  assert.equal(capabilities.canManageParticipants, true);
});

test('LINK_ONLY one-shot session requires share token for outsider', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 50,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.joinMode, 'REQUEST');
  assert.equal(capabilities.requiresShareTokenForOutsider, true);
});

test('LINK_ONLY one-shot session opens with valid share token', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 51,
    hasValidShareToken: true,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.joinMode, 'REQUEST');
  assert.equal(capabilities.requiresShareTokenForOutsider, true);
});

test('participant can open LINK_ONLY session without share token', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: true,
    isOwner: false,
    isConfirmedGm: false,
    userId: 52,
    hasValidShareToken: false,
  });

  assert.equal(capabilities.canDiscover, true);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.joinMode, 'REQUEST');
});

test('handles null userId with share token', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: null,
    hasValidShareToken: true,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.requiresShareTokenForOutsider, true);
});

test('handles undefined userId with share token', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: undefined,
    hasValidShareToken: true,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.requiresShareTokenForOutsider, true);
});

test('anonymous user cannot open LINK_ONLY session even with share token', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    hasValidShareToken: true,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, false);
  assert.equal(capabilities.requiresShareTokenForOutsider, true);
});

test('private campaign session with campaign share token opens for outsider', () => {
  const capabilities = getSessionViewerCapabilities({
    visibility: 'PRIVATE',
    isCampaignSession: true,
    isCampaignMember: false,
    isParticipant: false,
    isOwner: false,
    isConfirmedGm: false,
    userId: 53,
    hasValidShareToken: false,
    hasValidCampaignShareToken: true,
  });

  assert.equal(capabilities.canDiscover, false);
  assert.equal(capabilities.canOpen, true);
  assert.equal(capabilities.joinMode, 'MEMBERS_ONLY');
});

