const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { PrismaClient } = require('@prisma/client');

const test = require('node:test');
const assert = require('node:assert/strict');

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

    await testPrisma.$transaction(async (tx) => {
      await callback(tx);
      throw new Error('ROLLBACK');
    }).catch((err) => {
      if (err.message !== 'ROLLBACK') {
        throw err;
      }
    });
  } finally {
    await testPrisma.$disconnect();
  }
}

async function createTestUser(tx, overrides = {}) {
  const timestamp = Date.now();
  return tx.user.create({
    data: {
      username: `test_user_${timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      email: `test_${timestamp}@example.com`,
      password: 'password123',
      displayName: 'Test User',
      ...overrides,
    },
  });
}

async function createTestCampaign(tx, ownerId, overrides = {}) {
  return tx.campaign.create({
    data: {
      title: 'Test Campaign',
      description: 'A test campaign',
      visibility: 'PUBLIC',
      status: 'ACTIVE',
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
      ...overrides,
    },
    include: {
      members: true,
    },
  });
}

async function createJoinRequest(tx, userId, campaignId, message = null) {
  return tx.joinRequest.create({
    data: {
      userId,
      campaignId,
      message,
      status: 'PENDING',
    },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  });
}

test('happy path: PENDING → APPROVED → CampaignMember', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    const joinRequest = await createJoinRequest(tx, applicant.id, campaign.id, 'I want to join!');

    assert.equal(joinRequest.status, 'PENDING');
    assert.equal(joinRequest.userId, applicant.id);
    assert.equal(joinRequest.campaignId, campaign.id);
    assert.equal(joinRequest.message, 'I want to join!');
    assert.equal(joinRequest.reviewedAt, null);
    assert.equal(joinRequest.reviewedBy, null);

    const updatedRequest = await tx.joinRequest.update({
      where: { id: joinRequest.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: owner.id,
      },
    });

    assert.equal(updatedRequest.status, 'APPROVED');
    assert.ok(updatedRequest.reviewedAt);
    assert.equal(updatedRequest.reviewedBy, owner.id);

    const campaignMember = await tx.campaignMember.create({
      data: {
        userId: applicant.id,
        campaignId: campaign.id,
        role: 'PLAYER',
      },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    });

    assert.equal(campaignMember.userId, applicant.id);
    assert.equal(campaignMember.campaignId, campaign.id);
    assert.equal(campaignMember.role, 'PLAYER');
    assert.ok(campaignMember.joinedAt);

    const memberCheck = await tx.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId: applicant.id,
          campaignId: campaign.id,
        },
      },
    });

    assert.ok(memberCheck);
    assert.equal(memberCheck.role, 'PLAYER');
  });
});

test('reject join request deletes the request', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    const joinRequest = await createJoinRequest(tx, applicant.id, campaign.id, 'I want to join!');

    assert.equal(joinRequest.status, 'PENDING');

    await tx.joinRequest.delete({
      where: { id: joinRequest.id },
    });

    const deletedRequest = await tx.joinRequest.findUnique({
      where: { id: joinRequest.id },
    });

    assert.equal(deletedRequest, null);

    const memberCheck = await tx.campaignMember.findUnique({
      where: {
        userId_campaignId: {
          userId: applicant.id,
          campaignId: campaign.id,
        },
      },
    });

    assert.equal(memberCheck, null);
  });
});

test('cannot create CampaignMember if already exists', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    await tx.campaignMember.create({
      data: {
        userId: applicant.id,
        campaignId: campaign.id,
        role: 'PLAYER',
      },
    });

    let error = null;
    try {
      await tx.campaignMember.create({
        data: {
          userId: applicant.id,
          campaignId: campaign.id,
          role: 'PLAYER',
        },
      });
    } catch (err) {
      error = err;
    }

    assert.ok(error);
    assert.equal(error.code, 'P2002');
  });
});

test('cannot create duplicate PENDING join request', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    await createJoinRequest(tx, applicant.id, campaign.id, 'First request');

    let error = null;
    try {
      await createJoinRequest(tx, applicant.id, campaign.id, 'Second request');
    } catch (err) {
      error = err;
    }

    assert.ok(error);
    assert.equal(error.code, 'P2002');
  });
});

test('can re-submit join request after rejection', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    const firstRequest = await createJoinRequest(tx, applicant.id, campaign.id, 'First request');
    await tx.joinRequest.delete({ where: { id: firstRequest.id } });

    const secondRequest = await createJoinRequest(tx, applicant.id, campaign.id, 'Second request');

    assert.ok(secondRequest);
    assert.equal(secondRequest.status, 'PENDING');
    assert.equal(secondRequest.userId, applicant.id);
    assert.equal(secondRequest.campaignId, campaign.id);
  });
});

test('approve with GM role creates member with PLAYER role', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const gm = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    await tx.campaignMember.create({
      data: {
        userId: gm.id,
        campaignId: campaign.id,
        role: 'GM',
      },
    });

    const joinRequest = await createJoinRequest(tx, applicant.id, campaign.id, 'I want to join!');

    await tx.joinRequest.update({
      where: { id: joinRequest.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: gm.id,
      },
    });

    const campaignMember = await tx.campaignMember.create({
      data: {
        userId: applicant.id,
        campaignId: campaign.id,
        role: 'PLAYER',
      },
    });

    assert.equal(campaignMember.role, 'PLAYER');
  });
});

test('approve with OWNER role can create member with GM role', async () => {
  await withTestDatabase(async (tx) => {
    const owner = await createTestUser(tx);
    const applicant = await createTestUser(tx);
    const campaign = await createTestCampaign(tx, owner.id);

    const joinRequest = await createJoinRequest(tx, applicant.id, campaign.id, 'I want to join as GM!');

    await tx.joinRequest.update({
      where: { id: joinRequest.id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: owner.id,
      },
    });

    const campaignMember = await tx.campaignMember.create({
      data: {
        userId: applicant.id,
        campaignId: campaign.id,
        role: 'GM',
      },
    });

    assert.equal(campaignMember.role, 'GM');
  });
});
