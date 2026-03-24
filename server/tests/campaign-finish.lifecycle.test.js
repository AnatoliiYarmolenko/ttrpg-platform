const test = require('node:test');
const assert = require('node:assert/strict');

const campaignService = require('../src/services/campaign.service');
const { prisma } = require('../src/lib/prisma');

function withMockedCampaignLifecyclePrisma(mocks, callback) {
  const originalCampaignFindUnique = prisma.campaign.findUnique;
  const originalCampaignUpdate = prisma.campaign.update;
  const originalSessionUpdateMany = prisma.session.updateMany;
  const originalTransaction = prisma.$transaction;

  prisma.campaign.findUnique = mocks.campaignFindUnique;
  prisma.campaign.update = mocks.campaignUpdate;
  prisma.session.updateMany = mocks.sessionUpdateMany;
  prisma.$transaction = mocks.transaction;

  return Promise.resolve()
    .then(callback)
    .finally(() => {
      prisma.campaign.findUnique = originalCampaignFindUnique;
      prisma.campaign.update = originalCampaignUpdate;
      prisma.session.updateMany = originalSessionUpdateMany;
      prisma.$transaction = originalTransaction;
    });
}

test('Finishing campaign transitions session statuses', async () => {
  const sessionUpdateManyCalls = [];

  const campaignRecord = {
    id: 10,
    title: 'Campaign',
    description: null,
    imageUrl: null,
    system: 'DND5E',
    status: 'ACTIVE',
    visibility: 'LINK_ONLY',
    ownerId: 1,
    owner: { id: 1, username: 'owner', displayName: 'Owner' },
    members: [{ id: 1, userId: 1, role: 'OWNER', user: { id: 1, username: 'owner' } }],
    sessions: [],
    joinRequests: [],
  };

  await withMockedCampaignLifecyclePrisma(
    {
      campaignFindUnique: async () => campaignRecord,
      campaignUpdate: async ({ data }) => ({
        ...campaignRecord,
        status: data.status || campaignRecord.status,
      }),
      sessionUpdateMany: async (args) => {
        sessionUpdateManyCalls.push(args);
        return { count: 1 };
      },
      transaction: async (operations) => Promise.all(operations),
    },
    async () => {
      const updated = await campaignService.updateCampaign(10, 1, { status: 'FINISHED' });

      assert.equal(updated.status, 'FINISHED');
      assert.equal(sessionUpdateManyCalls.length, 2);
      assert.deepEqual(sessionUpdateManyCalls[0], {
        where: { campaignId: 10, status: 'ACTIVE' },
        data: { status: 'FINISHED' },
      });
      assert.deepEqual(sessionUpdateManyCalls[1], {
        where: { campaignId: 10, status: 'PLANNED' },
        data: { status: 'CANCELED' },
      });
    }
  );
});
