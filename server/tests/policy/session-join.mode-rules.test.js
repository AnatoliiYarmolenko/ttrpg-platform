const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getSessionJoinMode,
  JOIN_MODES,
} = require('../../src/domain/access/access-rules');

test('ONE_SHOT PUBLIC session has OPEN join mode', () => {
  const context = {
    visibility: 'PUBLIC',
    isCampaignSession: false,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.OPEN);
});

test('ONE_SHOT PRIVATE session has REQUEST join mode', () => {
  const context = {
    visibility: 'PRIVATE',
    isCampaignSession: false,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.REQUEST);
});

test('ONE_SHOT LINK_ONLY session has REQUEST join mode', () => {
  const context = {
    visibility: 'LINK_ONLY',
    isCampaignSession: false,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.REQUEST);
});

test('CAMPAIGN_SESSION PUBLIC session has REQUEST join mode', () => {
  const context = {
    visibility: 'PUBLIC',
    isCampaignSession: true,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.REQUEST);
});

test('CAMPAIGN_SESSION PRIVATE session has MEMBERS_ONLY join mode', () => {
  const context = {
    visibility: 'PRIVATE',
    isCampaignSession: true,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.MEMBERS_ONLY);
});

test('returns NOT_APPLICABLE for invalid visibility', () => {
  const context = {
    visibility: 'INVALID',
    isCampaignSession: false,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.NOT_APPLICABLE);
});

test('returns NOT_APPLICABLE for null visibility', () => {
  const context = {
    visibility: null,
    isCampaignSession: false,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.NOT_APPLICABLE);
});

test('returns NOT_APPLICABLE for undefined visibility', () => {
  const context = {
    visibility: undefined,
    isCampaignSession: false,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.NOT_APPLICABLE);
});

test('CAMPAIGN_SESSION LINK_ONLY falls back to NOT_APPLICABLE (no rule defined)', () => {
  const context = {
    visibility: 'LINK_ONLY',
    isCampaignSession: true,
  };
  const result = getSessionJoinMode(context);
  assert.equal(result, JOIN_MODES.NOT_APPLICABLE);
});

test('handles null context gracefully (edge case)', () => {
  const result = getSessionJoinMode(null);
  assert.equal(result, JOIN_MODES.NOT_APPLICABLE);
});

test('handles empty context gracefully', () => {
  const result = getSessionJoinMode({});
  assert.equal(result, JOIN_MODES.NOT_APPLICABLE);
});

test('join mode does not depend on user context (owner/member/outsider)', () => {
  const baseContext = {
    visibility: 'PUBLIC',
    isCampaignSession: false,
  };

  assert.equal(getSessionJoinMode({ ...baseContext, isOwner: true }), JOIN_MODES.OPEN);
  assert.equal(getSessionJoinMode({ ...baseContext, isOwner: false }), JOIN_MODES.OPEN);
  assert.equal(getSessionJoinMode({ ...baseContext, isCampaignMember: true }), JOIN_MODES.OPEN);
  assert.equal(getSessionJoinMode({ ...baseContext, isCampaignMember: false }), JOIN_MODES.OPEN);
  assert.equal(getSessionJoinMode({ ...baseContext, userId: 42 }), JOIN_MODES.OPEN);
  assert.equal(getSessionJoinMode({ ...baseContext, userId: null }), JOIN_MODES.OPEN);
});

test('isCampaignSession false treats as ONE_SHOT', () => {
  const context = {
    visibility: 'PUBLIC',
    isCampaignSession: false,
  };
  assert.equal(getSessionJoinMode(context), JOIN_MODES.OPEN);
});

test('isCampaignSession true treats as CAMPAIGN_SESSION', () => {
  const context = {
    visibility: 'PUBLIC',
    isCampaignSession: true,
  };
  assert.equal(getSessionJoinMode(context), JOIN_MODES.REQUEST);
});

test('isCampaignSession undefined treats as ONE_SHOT', () => {
  const context = {
    visibility: 'PUBLIC',
    isCampaignSession: undefined,
  };
  assert.equal(getSessionJoinMode(context), JOIN_MODES.OPEN);
});

test('isCampaignSession null treats as ONE_SHOT', () => {
  const context = {
    visibility: 'PUBLIC',
    isCampaignSession: null,
  };
  assert.equal(getSessionJoinMode(context), JOIN_MODES.OPEN);
});

test('all defined JOIN_MODES are distinct values', () => {
  const values = Object.values(JOIN_MODES);
  const uniqueValues = new Set(values);
  assert.equal(values.length, uniqueValues.size);
});

test('SESSION_ACCESS_RULES covers all visibility types for ONE_SHOT', () => {
  const { SESSION_ACCESS_RULES, SESSION_KINDS } = require('../../src/domain/access/access-rules');

  const oneShotRules = SESSION_ACCESS_RULES[SESSION_KINDS.ONE_SHOT];
  assert.ok(oneShotRules.PUBLIC);
  assert.ok(oneShotRules.PRIVATE);
  assert.ok(oneShotRules.LINK_ONLY);
});

test('SESSION_ACCESS_RULES covers PUBLIC and PRIVATE for CAMPAIGN_SESSION', () => {
  const { SESSION_ACCESS_RULES, SESSION_KINDS } = require('../../src/domain/access/access-rules');

  const campaignSessionRules = SESSION_ACCESS_RULES[SESSION_KINDS.CAMPAIGN_SESSION];
  assert.ok(campaignSessionRules.PUBLIC);
  assert.ok(campaignSessionRules.PRIVATE);
});
