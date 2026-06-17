const test = require('node:test');
const assert = require('node:assert/strict');

const createCampaignMembersService = require('../../src/services/campaign/campaign-members.service');

class AppError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ERROR_CODES = {
  SECURITY_ACCESS_DENIED: 'SECURITY_ACCESS_DENIED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CAMPAIGN_OWNER_REQUIRED: 'CAMPAIGN_OWNER_REQUIRED',
  CAMPAIGN_FINISHED: 'CAMPAIGN_FINISHED',
};

function buildMembersServiceContext(options = {}) {
  const state = {
    createdMembers: [],
    createdJoinRequests: [],
    deletedMembers: [],
    deletedJoinRequests: [],
    updatedJoinRequests: [],
    updatedRoles: [],
    updatedCampaigns: [],
  };

  const campaign = {
    id: options.campaignId || 10,
    ownerId: options.campaignOwnerId || 1,
    status: options.campaignStatus || 'ACTIVE',
    members: options.campaignMembers || [
      { userId: options.campaignOwnerId || 1, role: 'OWNER' },
      { userId: options.requesterId || 2, role: options.requesterRole || 'GM' },
    ],
  };

  const requesterRole = options.requesterRole || 'OWNER';

  const permissionHelpers = {
    _requireCampaignOwner(_deps, targetCampaign, userId, message = 'Owner only') {
      if (targetCampaign.ownerId !== userId) {
        throw new AppError(ERROR_CODES.CAMPAIGN_OWNER_REQUIRED, message);
      }
      return 'OWNER';
    },
    _requireCampaignRoles(_deps, _targetCampaign, _userId, allowedRoles, message = 'Forbidden') {
      if (!allowedRoles.includes(requesterRole)) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, message);
      }
      return requesterRole;
    },
  };

  const prisma = {
    campaign: {
      findUnique: async () => ({
        id: campaign.id,
        ownerId: campaign.ownerId,
        visibility: options.campaignVisibility || 'PRIVATE',
        status: options.campaignStatus || 'ACTIVE',
        members: campaign.members,
      }),
      update: async ({ data }) => {
        state.updatedCampaigns.push(data);
        return {
          id: campaign.id,
          ownerId: data.ownerId ?? campaign.ownerId,
          status: campaign.status,
        };
      },
    },
    campaignMember: {
      findUnique: async ({ where }) => {
        const lookupUserId = where?.userId_campaignId?.userId;

        if (
          options.memberRecord
          && Number(lookupUserId) === Number(options.memberRecord.userId)
        ) {
          return options.memberRecord;
        }

        if (Object.hasOwn(options, 'existingMember')) {
          return options.existingMember;
        }

        return null;
      },
      delete: async (args) => {
        state.deletedMembers.push(args);
        return { success: true };
      },
      create: async ({ data }) => {
        state.createdMembers.push(data);
        return {
          id: 999,
          ...data,
          user: { id: data.userId, username: `user_${data.userId}` },
        };
      },
      update: async ({ data }) => {
        state.updatedRoles.push(data);
        return {
          userId: options.memberRecord?.userId || 50,
          role: data.role,
          user: { id: options.memberRecord?.userId || 50, username: 'updated' },
        };
      },
    },
    user: {
      findUnique: async () => (options.userExists === false ? null : { id: 77 }),
    },
    joinRequest: {
      findUnique: async ({ where }) => {
        if (where?.id) {
          return options.joinRequest || { campaignId: 10, userId: 88, status: 'PENDING' };
        }

        if (where?.userId_campaignId) {
          return options.existingJoinRequest || null;
        }

        return null;
      },
      findFirst: async () => options.pendingRequest || null,
      create: async (args) => {
        state.createdJoinRequests.push(args);
        return {
          id: 501,
          ...args.data,
          user: {
            id: args.data.userId,
            username: `user_${args.data.userId}`,
            displayName: null,
            avatarUrl: null,
          },
        };
      },
      update: async (args) => {
        state.updatedJoinRequests.push(args);
        return {
          id: args.where?.id || 502,
          ...args.data,
          user: {
            id: 88,
            username: 'updated_user',
            displayName: null,
            avatarUrl: null,
          },
        };
      },
      delete: async (args) => {
        state.deletedJoinRequests.push(args);
        return { id: args.where?.id || 502 };
      },
    },
    $transaction: async (arg) => {
      if (typeof arg === 'function') {
        const tx = {
          ...prisma,
          joinRequest: {
            ...prisma.joinRequest,
            updateMany: async (args) => {
              state.updatedJoinRequests.push(args);
              return { count: 1 };
            },
          },
        };

        return arg(tx);
      }

      return Promise.all(arg);
    },
  };

  const getCampaignById = async () => campaign;

  const service = createCampaignMembersService({
    prisma,
    crypto: require('node:crypto'),
    AppError,
    ERROR_CODES,
    getCampaignById,
    permissionHelpers,
  });

  return { service, state };
}

test('submitJoinRequest for LINK_ONLY campaign with share token creates pending request', async () => {
  const { service, state } = buildMembersServiceContext({
    campaignVisibility: 'LINK_ONLY',
    existingMember: null,
  });

  const result = await service.submitJoinRequest(10, 55, 'Хочу приєднатись через лінк', 'valid-share-token');

  assert.equal(state.createdMembers.length, 0);
  assert.equal(state.createdJoinRequests.length, 1);
  assert.equal(state.createdJoinRequests[0].data.userId, 55);
  assert.equal(state.createdJoinRequests[0].data.campaignId, 10);
  assert.equal(state.createdJoinRequests[0].data.status, 'PENDING');
  assert.equal(result.status, 'PENDING');
});

test('submitJoinRequest for PUBLIC campaign creates pending request and does not auto-add member', async () => {
  const { service, state } = buildMembersServiceContext({
    campaignVisibility: 'PUBLIC',
    existingMember: null,
  });

  const result = await service.submitJoinRequest(10, 77, 'Хочу приєднатись');

  assert.equal(state.createdMembers.length, 0);
  assert.equal(state.createdJoinRequests.length, 1);
  assert.equal(state.createdJoinRequests[0].data.userId, 77);
  assert.equal(state.createdJoinRequests[0].data.campaignId, 10);
  assert.equal(state.createdJoinRequests[0].data.message, 'Хочу приєднатись');
  assert.equal(result.status, 'PENDING');
});

test('submitJoinRequest reopens reviewed request back to pending', async () => {
  const { service, state } = buildMembersServiceContext({
    campaignVisibility: 'PUBLIC',
    existingMember: null,
    existingJoinRequest: {
      id: 321,
      status: 'REJECTED',
      campaignId: 10,
      userId: 66,
    },
  });

  await service.submitJoinRequest(10, 66, 'Повторна заявка');

  assert.equal(state.createdJoinRequests.length, 0);
  assert.equal(state.updatedJoinRequests.length, 1);
  assert.equal(state.updatedJoinRequests[0].where.id, 321);
  assert.equal(state.updatedJoinRequests[0].data.status, 'PENDING');
  assert.equal(state.updatedJoinRequests[0].data.message, 'Повторна заявка');
});

test('rejectJoinRequest removes pending request record instead of marking REJECTED', async () => {
  const { service, state } = buildMembersServiceContext({
    requesterRole: 'OWNER',
    requesterId: 1,
    joinRequest: { id: 100, campaignId: 10, userId: 88, status: 'PENDING' },
  });

  await service.rejectJoinRequest(100, 1);

  assert.equal(state.deletedJoinRequests.length, 1);
  assert.equal(state.deletedJoinRequests[0].where.id, 100);
  assert.equal(state.updatedJoinRequests.length, 0);
});
