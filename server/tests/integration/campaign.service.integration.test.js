const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');
const test = require('node:test');
const assert = require('node:assert/strict');

const campaignService = require('../../src/services/campaign.service');
const { AppError } = require('../../src/constants/errors');

async function withTestDatabase(callback) {
  const testDbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

  if (!testDbUrl) {
    test.skip('DATABASE_URL not set, skipping integration test');
    return;
  }

  const testPrisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  try {
    await testPrisma.$connect();
  } finally {
    await testPrisma.$disconnect();
  }
}

const { prisma } = require('../../src/lib/prisma');

const TEST_USER_PREFIX = 'test_campaign_user_';

async function cleanDatabase() {
  const users = await prisma.user.findMany({
    where: { username: { startsWith: TEST_USER_PREFIX } },
    select: { id: true },
  });

  if (users.length === 0) {
    return;
  }

  const userIds = users.map(user => user.id);
  const campaigns = await prisma.campaign.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const sessions = await prisma.session.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const campaignIds = campaigns.map(campaign => campaign.id);
  const sessionIds = sessions.map(session => session.id);

  await prisma.sessionParticipant.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { sessionId: { in: sessionIds } },
      ],
    },
  });
  await prisma.joinRequest.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { campaignId: { in: campaignIds } },
      ],
    },
  });
  await prisma.campaignMember.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { campaignId: { in: campaignIds } },
      ],
    },
  });
  await prisma.chat.deleteMany({
    where: {
      OR: [
        { campaignId: { in: campaignIds } },
        { sessionId: { in: sessionIds } },
      ],
    },
  });
  await prisma.session.deleteMany({
    where: { id: { in: sessionIds } },
  });
  await prisma.campaign.deleteMany({
    where: { id: { in: campaignIds } },
  });
  await prisma.userStats.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });
}

async function createTestUser(overrides = {}) {
  const timestamp = Date.now();
  return prisma.user.create({
    data: {
      username: `${TEST_USER_PREFIX}${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_campaign_${timestamp}@example.com`,
      password: 'password123',
      displayName: 'Test User',
      ...overrides,
    },
  });
}

test('CampaignService Integration Tests', async (t) => {

  t.beforeEach(async () => {
    await cleanDatabase();
  });

  t.after(async () => {
    await cleanDatabase();
  });

  await t.test('createCampaign creates a campaign and sets owner as member', async () => {
    const owner = await createTestUser();
    
    const campaign = await campaignService.createCampaign({
      title: 'New Campaign',
      description: 'Desc',
      visibility: 'PUBLIC',
      ownerId: owner.id,
    });

    assert.equal(campaign.title, 'New Campaign');
    assert.equal(campaign.ownerId, owner.id);
    
    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
      include: { members: true, chat: true }
    });

    assert.ok(dbCampaign);
    assert.equal(dbCampaign.members.length, 1);
    assert.equal(dbCampaign.members[0].userId, owner.id);
    assert.equal(dbCampaign.members[0].role, 'OWNER');
    assert.ok(dbCampaign.chat); 
  });

  await t.test('createCampaign generates shareToken if visibility is LINK_ONLY', async () => {
    const owner = await createTestUser();
    
    const campaign = await campaignService.createCampaign({
      title: 'Secret Campaign',
      visibility: 'LINK_ONLY',
      ownerId: owner.id,
    });

    assert.ok(campaign.shareToken, 'Should return the raw shareToken in the response');
    
    const dbCampaign = await prisma.campaign.findUnique({
      where: { id: campaign.id },
    });

    assert.ok(dbCampaign.shareTokenHash);
    assert.ok(dbCampaign.shareTokenEncrypted);
    assert.ok(dbCampaign.shareTokenCreatedAt);
  });

  await t.test('getMyCampaigns returns campaigns with correct myRole and myStatus', async () => {
    const user1 = await createTestUser(); 
    const user2 = await createTestUser(); 
    const user3 = await createTestUser();
    const user4 = await createTestUser(); 

    const camp1 = await campaignService.createCampaign({ title: 'C1', visibility: 'PUBLIC', ownerId: user1.id });
    const camp2 = await campaignService.createCampaign({ title: 'C2', visibility: 'PUBLIC', ownerId: user2.id });
    
    await prisma.campaignMember.create({ data: { campaignId: camp1.id, userId: user2.id, role: 'PLAYER' } });
    
    await prisma.joinRequest.create({ data: { campaignId: camp1.id, userId: user3.id } });

    const user1Campaigns = await campaignService.getMyCampaigns(user1.id);
    assert.equal(user1Campaigns.length, 1);
    assert.equal(user1Campaigns[0].id, camp1.id);
    assert.equal(user1Campaigns[0].myRole, 'OWNER');
    assert.equal(user1Campaigns[0].myStatus, 'CONFIRMED');

    const user2Campaigns = await campaignService.getMyCampaigns(user2.id);
    assert.equal(user2Campaigns.length, 2);
    const c1ForU2 = user2Campaigns.find(c => c.id === camp1.id);
    const c2ForU2 = user2Campaigns.find(c => c.id === camp2.id);
    
    assert.equal(c1ForU2.myRole, 'PLAYER');
    assert.equal(c1ForU2.myStatus, 'CONFIRMED');
    assert.equal(c2ForU2.myRole, 'OWNER');
    
    const user3Campaigns = await campaignService.getMyCampaigns(user3.id);
    assert.equal(user3Campaigns.length, 1);
    assert.equal(user3Campaigns[0].myRole, null);
    assert.equal(user3Campaigns[0].myStatus, 'PENDING');

    const user4Campaigns = await campaignService.getMyCampaigns(user4.id);
    assert.equal(user4Campaigns.length, 0);
  });

  await t.test('getCampaignById computes viewerCapabilities correctly', async () => {
    const owner = await createTestUser();
    const player = await createTestUser();
    const outsider = await createTestUser();

    const campaign = await campaignService.createCampaign({ title: 'C1', visibility: 'PUBLIC', ownerId: owner.id });
    await prisma.campaignMember.create({ data: { campaignId: campaign.id, userId: player.id, role: 'PLAYER' } });
    await prisma.joinRequest.create({ data: { campaignId: campaign.id, userId: outsider.id } });

    const ownerView = await campaignService.getCampaignById(campaign.id, owner.id);
    assert.equal(ownerView.viewer.isOwner, true);
    assert.equal(ownerView.viewer.canManage, true);
    assert.ok(ownerView.joinRequests, 'Owner should see join requests');

    const playerView = await campaignService.getCampaignById(campaign.id, player.id);
    assert.equal(playerView.viewer.isMember, true);
    assert.equal(playerView.viewer.canManage, false);
    assert.equal(playerView.joinRequests, undefined, 'Player should NOT see join requests');

    const outsiderView = await campaignService.getCampaignById(campaign.id, outsider.id);
    assert.equal(outsiderView.viewer.isMember, false);
    assert.equal(outsiderView.viewer.pendingJoinRequestStatus, 'PENDING');
  });

  await t.test('updateCampaign updates basic fields and visibility', async () => {
    const owner = await createTestUser();
    const campaign = await campaignService.createCampaign({ title: 'Old', visibility: 'PUBLIC', ownerId: owner.id });

    const updated = await campaignService.updateCampaign(campaign.id, owner.id, {
      title: 'New',
      visibility: 'LINK_ONLY'
    });

    assert.equal(updated.title, 'New');
    assert.equal(updated.visibility, 'LINK_ONLY');
    assert.ok(updated.shareToken, 'Switching to LINK_ONLY should generate share token');

    const updatedDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert.ok(updatedDb.shareTokenHash);

    const updatedBack = await campaignService.updateCampaign(campaign.id, owner.id, {
      visibility: 'PUBLIC'
    });
    
    assert.equal(updatedBack.visibility, 'PUBLIC');
    const updatedBackDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert.equal(updatedBackDb.shareTokenHash, null, 'Switching to PUBLIC should clear share token');
  });

  await t.test('finishing campaign transitions ACTIVE to FINISHED and PLANNED to CANCELED', async () => {
    const owner = await createTestUser();
    const campaign = await campaignService.createCampaign({ title: 'C1', visibility: 'PUBLIC', ownerId: owner.id });
    
    const activeSession = await prisma.session.create({
      data: { campaignId: campaign.id, ownerId: owner.id, title: 'Active', status: 'ACTIVE', date: new Date(), maxPlayers: 5, visibility: 'PUBLIC' }
    });
    const plannedSession = await prisma.session.create({
      data: { campaignId: campaign.id, ownerId: owner.id, title: 'Planned', status: 'PLANNED', date: new Date(), maxPlayers: 5, visibility: 'PUBLIC' }
    });

    await campaignService.updateCampaign(campaign.id, owner.id, { status: 'FINISHED' });

    const activeDb = await prisma.session.findUnique({ where: { id: activeSession.id } });
    const plannedDb = await prisma.session.findUnique({ where: { id: plannedSession.id } });
    const campDb = await prisma.campaign.findUnique({ where: { id: campaign.id } });

    assert.equal(campDb.status, 'FINISHED');
    assert.equal(activeDb.status, 'FINISHED');
    assert.equal(plannedDb.status, 'CANCELED');
  });

  await t.test('getCampaignByShareToken returns campaign if token matches', async () => {
    const owner = await createTestUser();
    const outsider = await createTestUser();
    
    const campaign = await campaignService.createCampaign({
      title: 'Secret Campaign',
      visibility: 'LINK_ONLY',
      ownerId: owner.id,
    });

    const token = campaign.shareToken;

    const campaignView = await campaignService.getCampaignByShareToken(token, outsider.id);
    assert.equal(campaignView.id, campaign.id);
    assert.equal(campaignView.viewer.canOpen, true);
  });

  await t.test('regenerateShareToken creates new token for LINK_ONLY campaign', async () => {
    const owner = await createTestUser();
    const campaign = await campaignService.createCampaign({
      title: 'Secret',
      visibility: 'LINK_ONLY',
      ownerId: owner.id,
    });

    const oldToken = campaign.shareToken;
    const { token: newToken } = await campaignService.regenerateShareToken(campaign.id, owner.id);

    assert.notEqual(oldToken, newToken);
    
    const dbCamp = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    const { hashToken } = require('../../src/utils/token.helper');
    assert.equal(dbCamp.shareTokenHash, hashToken(newToken));
  });

  await t.test('getCampaignShareLink returns decrypted token', async () => {
    const owner = await createTestUser();
    const campaign = await campaignService.createCampaign({
      title: 'Secret',
      visibility: 'LINK_ONLY',
      ownerId: owner.id,
    });

    const linkInfo = await campaignService.getCampaignShareLink(campaign.id, owner.id);
    assert.equal(linkInfo.token, campaign.shareToken);
    assert.ok(linkInfo.shareUrl.includes(campaign.shareToken));
  });

});
