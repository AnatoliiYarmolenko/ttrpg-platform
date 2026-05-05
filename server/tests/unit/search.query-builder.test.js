const test = require('node:test');
const assert = require('node:assert/strict');

const {
  appendAndClause,
  buildOwnerUserFilter,
  resolveRangeStart,
  resolveRangeEnd,
  applySessionOwnerFilter,
  applySessionParticipationFilter,
  applySessionDateRange,
  applySessionPriceRange,
  buildCampaignSearchWhere,
  buildSessionSearchWhere,
  resolveCampaignOrderBy,
  resolveSessionOrderBy,
} = require('../../src/services/search.service');

test('appendAndClause adds clause to empty where', () => {
  const where = {};
  appendAndClause(where, { status: 'ACTIVE' });
  assert.deepEqual(where.AND, [{ status: 'ACTIVE' }]);
});

test('appendAndClause appends to existing AND array', () => {
  const where = { AND: [{ visibility: 'PUBLIC' }] };
  appendAndClause(where, { status: 'ACTIVE' });
  assert.equal(where.AND.length, 2);
  assert.deepEqual(where.AND[1], { status: 'ACTIVE' });
});

test('buildOwnerUserFilter returns null for empty/whitespace username', () => {
  assert.equal(buildOwnerUserFilter(''), null);
  assert.equal(buildOwnerUserFilter('   '), null);
  assert.equal(buildOwnerUserFilter(null), null);
  assert.equal(buildOwnerUserFilter(undefined), null);
});

test('buildOwnerUserFilter returns OR clause for username search', () => {
  const result = buildOwnerUserFilter('gm_master');
  assert.equal(result.length, 2);
  assert.equal(result[0].owner.username.contains, 'gm_master');
  assert.equal(result[0].owner.username.mode, 'insensitive');
  assert.equal(result[1].owner.displayName.contains, 'gm_master');
  assert.equal(result[1].owner.displayName.mode, 'insensitive');
});

test('buildOwnerUserFilter trims whitespace from username', () => {
  const result = buildOwnerUserFilter('  gm_master  ');
  assert.equal(result[0].owner.username.contains, 'gm_master');
});

test('resolveRangeStart returns null for empty input', () => {
  assert.equal(resolveRangeStart(null), null);
  assert.equal(resolveRangeStart(undefined), null);
  assert.equal(resolveRangeStart(''), null);
});

test('resolveRangeStart returns Date for valid input', () => {
  const result = resolveRangeStart('2026-05-01');
  assert.ok(result instanceof Date);
  assert.equal(result.toISOString().startsWith('2026-05-01'), true);
});

test('resolveRangeEnd returns null for empty input', () => {
  assert.equal(resolveRangeEnd(null), null);
  assert.equal(resolveRangeEnd(undefined), null);
  assert.equal(resolveRangeEnd(''), null);
});

test('resolveRangeEnd sets time to end of day for YYYY-MM-DD format', () => {
  const result = resolveRangeEnd('2026-05-01');
  assert.ok(result instanceof Date);
  assert.equal(result.getUTCHours(), 23);
  assert.equal(result.getUTCMinutes(), 59);
  assert.equal(result.getUTCSeconds(), 59);
  assert.equal(result.getUTCMilliseconds(), 999);
});

test('resolveRangeEnd preserves time for full ISO string', () => {
  const result = resolveRangeEnd('2026-05-01T12:30:00.000Z');
  assert.ok(result instanceof Date);
  assert.equal(result.getUTCHours(), 12);
  assert.equal(result.getUTCMinutes(), 30);
});

test('applySessionOwnerFilter does nothing for empty username', () => {
  const where = { status: 'PLANNED' };
  applySessionOwnerFilter(where, '');
  assert.equal(where.AND, undefined);
});

test('applySessionOwnerFilter adds AND clause for valid username', () => {
  const where = { status: 'PLANNED' };
  applySessionOwnerFilter(where, 'keeper');
  assert.ok(where.AND);
  assert.equal(where.AND[0].OR.length, 2);
});

test('applySessionParticipationFilter does nothing when not requested', () => {
  const where = { status: 'PLANNED' };
  applySessionParticipationFilter(where, 42, false);
  assert.equal(where.AND, undefined);
});

test('applySessionParticipationFilter does nothing without userId', () => {
  const where = { status: 'PLANNED' };
  applySessionParticipationFilter(where, null, true);
  assert.equal(where.AND, undefined);
});

test('applySessionParticipationFilter adds owner or participant clause', () => {
  const where = { status: 'PLANNED' };
  applySessionParticipationFilter(where, 42, true);
  assert.ok(where.AND);
  const clause = where.AND[0].OR;
  assert.equal(clause[0].ownerId, 42);
  assert.equal(clause[1].participants.some.userId, 42);
  assert.equal(clause[1].participants.some.status, 'CONFIRMED');
});

test('applySessionDateRange sets explicit date range when provided', () => {
  const where = {};
  applySessionDateRange(where, '2026-05-01', '2026-05-31');
  assert.ok(where.date.gte instanceof Date);
  assert.ok(where.date.lte instanceof Date);
  assert.equal(where.AND, undefined);
});

test('applySessionDateRange adds default window when no dates provided', () => {
  const where = {};
  applySessionDateRange(where, null, null);
  assert.ok(where.AND);
  const defaultWindow = where.AND[0].OR;
  assert.equal(defaultWindow[0].status, 'ACTIVE');
  assert.equal(defaultWindow[1].status, 'PLANNED');
  assert.ok(defaultWindow[1].date.gte instanceof Date);
});

test('applySessionDateRange handles only dateFrom', () => {
  const where = {};
  applySessionDateRange(where, '2026-05-01', null);
  assert.ok(where.date.gte);
  assert.equal(where.date.lte, undefined);
});

test('applySessionDateRange handles only dateTo', () => {
  const where = {};
  applySessionDateRange(where, null, '2026-05-31');
  assert.equal(where.date.gte, undefined);
  assert.ok(where.date.lte);
});

test('applySessionPriceRange does nothing when no prices provided', () => {
  const where = {};
  applySessionPriceRange(where, undefined, undefined);
  assert.equal(where.price, undefined);
});

test('applySessionPriceRange sets min price only', () => {
  const where = {};
  applySessionPriceRange(where, 10, undefined);
  assert.equal(where.price.gte, 10);
  assert.equal(where.price.lte, undefined);
});

test('applySessionPriceRange sets max price only', () => {
  const where = {};
  applySessionPriceRange(where, undefined, 50);
  assert.equal(where.price.gte, undefined);
  assert.equal(where.price.lte, 50);
});

test('applySessionPriceRange sets price range', () => {
  const where = {};
  applySessionPriceRange(where, 10, 50);
  assert.equal(where.price.gte, 10);
  assert.equal(where.price.lte, 50);
});

test('resolveCampaignOrderBy returns newest by default', () => {
  assert.deepEqual(resolveCampaignOrderBy(), { createdAt: 'desc' });
  assert.deepEqual(resolveCampaignOrderBy('invalid'), { createdAt: 'desc' });
  assert.deepEqual(resolveCampaignOrderBy('newest'), { createdAt: 'desc' });
});

test('resolveCampaignOrderBy returns popular sort', () => {
  assert.deepEqual(resolveCampaignOrderBy('popular'), { members: { _count: 'desc' } });
});

test('resolveCampaignOrderBy returns title sort', () => {
  assert.deepEqual(resolveCampaignOrderBy('title'), { title: 'asc' });
});

test('resolveSessionOrderBy returns date by default', () => {
  assert.deepEqual(resolveSessionOrderBy(), { date: 'asc' });
  assert.deepEqual(resolveSessionOrderBy('invalid'), { date: 'asc' });
  assert.deepEqual(resolveSessionOrderBy('date'), { date: 'asc' });
});

test('resolveSessionOrderBy returns price sort', () => {
  assert.deepEqual(resolveSessionOrderBy('price'), { price: 'asc' });
});

test('resolveSessionOrderBy returns newest sort', () => {
  assert.deepEqual(resolveSessionOrderBy('newest'), { createdAt: 'desc' });
});

test('buildCampaignSearchWhere includes discovery filter with userId', () => {
  const where = buildCampaignSearchWhere({ userId: 42 });
  assert.equal(where.status, 'ACTIVE');
  assert.ok(where.AND);
});

test('buildCampaignSearchWhere includes text search when query provided', () => {
  const where = buildCampaignSearchWhere({ query: 'D&D' });
  assert.ok(where.OR);
  assert.equal(where.OR[0].title.contains, 'D&D');
  assert.equal(where.OR[1].description.contains, 'D&D');
});

test('buildCampaignSearchWhere trims query whitespace', () => {
  const where = buildCampaignSearchWhere({ query: '  D&D  ' });
  assert.equal(where.OR[0].title.contains, 'D&D');
});

test('buildCampaignSearchWhere includes system filter', () => {
  const where = buildCampaignSearchWhere({ system: 'Call of Cthulhu' });
  assert.equal(where.system.contains, 'Call of Cthulhu');
  assert.equal(where.system.mode, 'insensitive');
});

test('buildCampaignSearchWhere includes owner username filter', () => {
  const where = buildCampaignSearchWhere({ ownerUsername: 'gm_master' });
  assert.ok(where.AND);
  const ownerClause = where.AND.find(clause => clause.OR?.[0]?.owner?.username);
  assert.ok(ownerClause);
});

test('buildCampaignSearchWhere includes participation filter', () => {
  const where = buildCampaignSearchWhere({ userId: 42, onlyMyParticipation: true });
  assert.ok(where.AND);
  const participationClause = where.AND.find(clause => 
    clause.OR?.some(o => o.ownerId === 42)
  );
  assert.ok(participationClause);
});

test('buildCampaignSearchWhere combines multiple filters', () => {
  const where = buildCampaignSearchWhere({
    userId: 42,
    query: 'campaign',
    system: 'D&D',
    ownerUsername: 'gm',
    onlyMyParticipation: true,
  });
  assert.ok(where.OR);
  assert.ok(where.system);
  assert.ok(where.AND);
  assert.ok(where.AND.length >= 2);
});

test('buildSessionSearchWhere defaults to PLANNED and ACTIVE status', () => {
  const where = buildSessionSearchWhere({});
  assert.deepEqual(where.status, { in: ['PLANNED', 'ACTIVE'] });
});

test('buildSessionSearchWhere includes discovery filter', () => {
  const where = buildSessionSearchWhere({ userId: 42 });
  assert.ok(where.AND);
});

test('buildSessionSearchWhere includes text search', () => {
  const where = buildSessionSearchWhere({ query: 'one-shot' });
  assert.ok(where.OR);
  assert.equal(where.OR[0].title.contains, 'one-shot');
});

test('buildSessionSearchWhere includes system filter with campaign fallback', () => {
  const where = buildSessionSearchWhere({ system: 'D&D' });
  assert.ok(where.AND);
  const systemClause = where.AND.find(clause => 
    clause.OR?.some(o => o.system?.contains === 'D&D')
  );
  assert.ok(systemClause);
  assert.ok(systemClause.OR[1].campaign.system);
});

test('buildSessionSearchWhere includes owner filter', () => {
  const where = buildSessionSearchWhere({ ownerUsername: 'keeper' });
  assert.ok(where.AND);
  const ownerClause = where.AND.find(clause => 
    clause.OR?.[0]?.owner?.username?.contains === 'keeper'
  );
  assert.ok(ownerClause);
});

test('buildSessionSearchWhere includes participation filter when requested', () => {
  const where = buildSessionSearchWhere({ userId: 42, onlyMyParticipation: true });
  assert.ok(where.AND);
  const participationClause = where.AND.find(clause =>
    clause.OR?.some(o => o.ownerId === 42)
  );
  assert.ok(participationClause);
});

test('buildSessionSearchWhere includes date range when provided', () => {
  const where = buildSessionSearchWhere({ dateFrom: '2026-05-01', dateTo: '2026-05-31' });
  assert.ok(where.date);
  assert.ok(where.date.gte instanceof Date);
  assert.ok(where.date.lte instanceof Date);
});

test('buildSessionSearchWhere adds default date window when no dates', () => {
  const where = buildSessionSearchWhere({});
  assert.ok(where.AND);
  const dateClause = where.AND.find(clause => clause.OR?.[0]?.status === 'ACTIVE');
  assert.ok(dateClause);
});

test('buildSessionSearchWhere includes price range', () => {
  const where = buildSessionSearchWhere({ minPrice: 10, maxPrice: 50 });
  assert.equal(where.price.gte, 10);
  assert.equal(where.price.lte, 50);
});

test('buildSessionSearchWhere sets oneShot filter', () => {
  const where = buildSessionSearchWhere({ oneShot: true });
  assert.equal(where.campaignId, null);
});
