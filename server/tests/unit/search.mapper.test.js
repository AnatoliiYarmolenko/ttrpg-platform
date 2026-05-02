const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatCampaignSearchResult,
  formatSessionSearchResult,
  countConfirmedPlayers,
  hasAvailablePlayerSlots,
} = require('../../src/services/search.service');

function buildMockCampaign(overrides = {}) {
  return {
    id: 1,
    title: 'Test Campaign',
    description: 'A test campaign',
    imageUrl: 'https://example.com/image.jpg',
    system: 'D&D 5e',
    visibility: 'PUBLIC',
    owner: { id: 1, username: 'gm', displayName: 'Game Master' },
    _count: { members: 5, sessions: 10 },
    createdAt: new Date('2026-01-15'),
    ...overrides,
  };
}

function buildMockSession(overrides = {}) {
  return {
    id: 1,
    title: 'Test Session',
    description: 'A test session',
    date: new Date('2026-05-01T18:00:00Z'),
    duration: 180,
    status: 'PLANNED',
    price: 10,
    maxPlayers: 5,
    visibility: 'PUBLIC',
    ownerId: 1,
    owner: { id: 1, username: 'gm', displayName: 'Game Master', avatarUrl: null },
    campaign: null,
    campaignId: null,
    system: 'D&D 5e',
    participants: [
      { id: 1, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 3, role: 'PLAYER', status: 'PENDING' },
      { id: 4, role: 'GM', status: 'CONFIRMED' },
    ],
    _count: { participants: 4 },
    createdAt: new Date('2026-04-01'),
    ...overrides,
  };
}

test('formatCampaignSearchResult maps all fields correctly', () => {
  const campaign = buildMockCampaign();
  const result = formatCampaignSearchResult(campaign);

  assert.equal(result.id, 1);
  assert.equal(result.title, 'Test Campaign');
  assert.equal(result.description, 'A test campaign');
  assert.equal(result.imageUrl, 'https://example.com/image.jpg');
  assert.equal(result.system, 'D&D 5e');
  assert.equal(result.visibility, 'PUBLIC');
  assert.deepEqual(result.owner, campaign.owner);
  assert.equal(result.membersCount, 5);
  assert.equal(result.sessionsCount, 10);
  assert.ok(result.createdAt instanceof Date);
});

test('formatCampaignSearchResult handles null description and imageUrl', () => {
  const campaign = buildMockCampaign({
    description: null,
    imageUrl: null,
  });
  const result = formatCampaignSearchResult(campaign);

  assert.equal(result.description, null);
  assert.equal(result.imageUrl, null);
});

test('countConfirmedPlayers counts only confirmed players', () => {
  const session = buildMockSession();
  const count = countConfirmedPlayers(session);

  assert.equal(count, 2);
});

test('countConfirmedPlayers returns 0 when no participants', () => {
  const session = buildMockSession({ participants: [] });
  const count = countConfirmedPlayers(session);

  assert.equal(count, 0);
});

test('countConfirmedPlayers excludes GM role even when confirmed', () => {
  const session = buildMockSession({
    participants: [
      { id: 1, role: 'GM', status: 'CONFIRMED' },
      { id: 2, role: 'GM', status: 'CONFIRMED' },
    ],
  });
  const count = countConfirmedPlayers(session);

  assert.equal(count, 0);
});

test('countConfirmedPlayers excludes pending players', () => {
  const session = buildMockSession({
    participants: [
      { id: 1, role: 'PLAYER', status: 'PENDING' },
      { id: 2, role: 'PLAYER', status: 'PENDING' },
    ],
  });
  const count = countConfirmedPlayers(session);

  assert.equal(count, 0);
});

test('hasAvailablePlayerSlots returns true when slots available', () => {
  const session = buildMockSession({
    maxPlayers: 5,
    participants: [
      { id: 1, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  });

  assert.equal(hasAvailablePlayerSlots(session), true);
});

test('hasAvailablePlayerSlots returns false when full', () => {
  const session = buildMockSession({
    maxPlayers: 2,
    participants: [
      { id: 1, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  });

  assert.equal(hasAvailablePlayerSlots(session), false);
});

test('hasAvailablePlayerSlots returns false when overbooked', () => {
  const session = buildMockSession({
    maxPlayers: 1,
    participants: [
      { id: 1, role: 'PLAYER', status: 'CONFIRMED' },
      { id: 2, role: 'PLAYER', status: 'CONFIRMED' },
    ],
  });

  assert.equal(hasAvailablePlayerSlots(session), false);
});

test('formatSessionSearchResult maps basic fields correctly', () => {
  const session = buildMockSession();
  const result = formatSessionSearchResult(session);

  assert.equal(result.id, 1);
  assert.equal(result.title, 'Test Session');
  assert.equal(result.description, 'A test session');
  assert.ok(result.date instanceof Date);
  assert.equal(result.duration, 180);
  assert.equal(result.status, 'PLANNED');
  assert.equal(result.price, 10);
  assert.equal(result.maxPlayers, 5);
  assert.equal(result.visibility, 'PUBLIC');
  assert.equal(result.ownerId, 1);
  assert.ok(result.createdAt instanceof Date);
});

test('formatSessionSearchResult calculates currentPlayers correctly', () => {
  const session = buildMockSession();
  const result = formatSessionSearchResult(session);

  assert.equal(result.currentPlayers, 2);
});

test('formatSessionSearchResult calculates availableSlots correctly', () => {
  const session = buildMockSession();
  const result = formatSessionSearchResult(session);

  assert.equal(result.availableSlots, 3);
});

test('formatSessionSearchResult returns null campaign when session has no campaign', () => {
  const session = buildMockSession({ campaign: null, campaignId: null });
  const result = formatSessionSearchResult(session);

  assert.equal(result.campaign, null);
  assert.equal(result.isOneShot, true);
});

test('formatSessionSearchResult includes campaign data when present', () => {
  const session = buildMockSession({
    campaignId: 100,
    campaign: {
      id: 100,
      title: 'Parent Campaign',
      system: 'Pathfinder',
      visibility: 'PUBLIC',
    },
  });
  const result = formatSessionSearchResult(session);

  assert.equal(result.campaign.title, 'Parent Campaign');
  assert.equal(result.isOneShot, false);
});

test('formatSessionSearchResult uses campaign system when session has none', () => {
  const session = buildMockSession({
    system: null,
    campaign: {
      id: 100,
      title: 'Parent Campaign',
      system: 'Pathfinder',
      visibility: 'PUBLIC',
    },
  });
  const result = formatSessionSearchResult(session);

  assert.equal(result.system, 'Pathfinder');
});

test('formatSessionSearchResult uses session system over campaign system', () => {
  const session = buildMockSession({
    system: 'D&D 5e',
    campaign: {
      id: 100,
      title: 'Parent Campaign',
      system: 'Pathfinder',
      visibility: 'PUBLIC',
    },
  });
  const result = formatSessionSearchResult(session);

  assert.equal(result.system, 'D&D 5e');
});

test('formatSessionSearchResult handles sanitized campaign for LINK_ONLY visibility', () => {
  const session = buildMockSession({
    campaignId: 100,
    campaign: {
      id: 100,
      title: 'Private Campaign',
      system: 'D&D 5e',
      visibility: 'LINK_ONLY',
    },
  });
  const result = formatSessionSearchResult(session, 999);

  if (result.campaign) {
    assert.equal(result.campaign.id, null);
    assert.equal(result.campaign.canOpenDirectly, false);
  }
});
