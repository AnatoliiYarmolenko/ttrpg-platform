const test = require('node:test');
const assert = require('node:assert/strict');

const createCampaignMembersService = require('../src/services/campaign/campaign-members.service');

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
      findUnique: async ({ where }) => {
        if (where?.inviteCode) {
          return {
            id: campaign.id,
            ownerId: campaign.ownerId,
            visibility: options.inviteCampaignVisibility || 'PUBLIC',
            title: 'Invite Campaign',
            status: options.campaignStatus || 'ACTIVE',
          };
        }

        return {
          id: campaign.id,
          ownerId: campaign.ownerId,
          visibility: options.campaignVisibility || 'PRIVATE',
          status: options.campaignStatus || 'ACTIVE',
          members: campaign.members,
        };
      },
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

        if (Object.prototype.hasOwnProperty.call(options, 'existingMember')) {
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
          ...(args.data || {}),
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
          joinRequest: {
            updateMany: async (args) => {
              state.updatedJoinRequests.push(args);
              return { count: 1 };
            },
            delete: async (args) => {
              state.deletedJoinRequests.push(args);
              return { id: args.where?.id || 502 };
            },
          },
          campaignMember: {
            create: async ({ data }) => {
              state.createdMembers.push(data);
              return {
                id: 999,
                ...data,
                user: { id: data.userId, username: `user_${data.userId}` },
              };
            },
            findUnique: async ({ where }) => {
              const lookupUserId = where?.userId_campaignId?.userId;
              if (
                options.memberRecord
                && Number(lookupUserId) === Number(options.memberRecord.userId)
              ) {
                return options.memberRecord;
              }

              if (Object.prototype.hasOwnProperty.call(options, 'existingMember')) {
                return options.existingMember;
              }

              return null;
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
    crypto: require('crypto'),
    AppError,
    ERROR_CODES,
    getCampaignById,
    permissionHelpers,
  });

  return { service, state };
}

test('GM cannot add a GM directly to campaign', async () => {
  const { service } = buildMembersServiceContext({ requesterRole: 'GM', requesterId: 2 });

  await assert.rejects(
    () => service.addMemberToCampaign(10, 2, 77, 'GM'),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
      && /додавати до кампанії тільки гравців/i.test(error.message)
  );
});

test('Owner can add a GM to campaign', async () => {
  const { service, state } = buildMembersServiceContext({ requesterRole: 'OWNER', requesterId: 1 });

  await service.addMemberToCampaign(10, 1, 77, 'GM');

  assert.equal(state.createdMembers.length, 1);
  assert.equal(state.createdMembers[0].role, 'GM');
});

test('GM can remove PLAYER from campaign', async () => {
  const { service, state } = buildMembersServiceContext({
    requesterRole: 'GM',
    requesterId: 2,
    memberRecord: { userId: 55, role: 'PLAYER' },
  });

  await service.removeMemberFromCampaign(10, 2, 55);

  assert.equal(state.deletedMembers.length, 1);
});

test('GM cannot remove another GM from campaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'GM',
    requesterId: 2,
    memberRecord: { userId: 55, role: 'GM' },
  });

  await assert.rejects(
    () => service.removeMemberFromCampaign(10, 2, 55),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
      && /тільки гравців/i.test(error.message)
  );
});

test('GM can remove self from campaign', async () => {
  const { service, state } = buildMembersServiceContext({
    requesterRole: 'GM',
    requesterId: 2,
    memberRecord: { userId: 2, role: 'GM' },
  });

  await service.removeMemberFromCampaign(10, 2, 2);

  assert.equal(state.deletedMembers.length, 1);
});

test('PLAYER can leave campaign by removing self', async () => {
  const { service, state } = buildMembersServiceContext({
    requesterRole: 'PLAYER',
    requesterId: 55,
    memberRecord: { userId: 55, role: 'PLAYER' },
  });

  await service.removeMemberFromCampaign(10, 55, 55);

  assert.equal(state.deletedMembers.length, 1);
});

test('PLAYER cannot remove another member from campaign', async () => {
  const { service, state } = buildMembersServiceContext({
    requesterRole: 'PLAYER',
    requesterId: 55,
    memberRecord: { userId: 77, role: 'PLAYER' },
  });

  await assert.rejects(
    () => service.removeMemberFromCampaign(10, 55, 77),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
      && /видаляти учасників/i.test(error.message)
  );

  assert.equal(state.deletedMembers.length, 0);
});

test('No one can remove campaign owner via removeMemberFromCampaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'GM',
    requesterId: 2,
    memberRecord: { userId: 1, role: 'OWNER' },
  });

  await assert.rejects(
    () => service.removeMemberFromCampaign(10, 2, 1),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
      && /власника кампанії/i.test(error.message)
  );
});

test('GM cannot approve join request with GM role', async () => {
  const { service } = buildMembersServiceContext({ requesterRole: 'GM', requesterId: 2 });

  await assert.rejects(
    () => service.approveJoinRequest(100, 2, 'GM'),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.SECURITY_ACCESS_DENIED
      && /тільки з роллю гравця/i.test(error.message)
  );
});

test('GM can approve join request only as PLAYER', async () => {
  const { service, state } = buildMembersServiceContext({ requesterRole: 'GM', requesterId: 2 });

  await service.approveJoinRequest(100, 2, 'PLAYER');

  assert.equal(state.createdMembers.length, 1);
  assert.equal(state.createdMembers[0].role, 'PLAYER');
});

test('Owner can approve join request as GM', async () => {
  const { service, state } = buildMembersServiceContext({ requesterRole: 'OWNER', requesterId: 1 });

  await service.approveJoinRequest(100, 1, 'GM');

  assert.equal(state.createdMembers.length, 1);
  assert.equal(state.createdMembers[0].role, 'GM');
});

test('updateMemberRole does not allow OWNER role reassignment', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'OWNER',
    requesterId: 1,
    memberRecord: { userId: 55, role: 'PLAYER' },
  });

  await assert.rejects(
    () => service.updateMemberRole(10, 1, 55, 'OWNER'),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.VALIDATION_INVALID_FORMAT
  );
});

test('Cannot add members to finished campaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'OWNER',
    requesterId: 1,
    campaignStatus: 'FINISHED',
  });

  await assert.rejects(
    () => service.addMemberToCampaign(10, 1, 77, 'PLAYER'),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.CAMPAIGN_FINISHED
  );
});

test('Cannot submit join request to finished campaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'PLAYER',
    requesterId: 55,
    campaignStatus: 'FINISHED',
  });

  await assert.rejects(
    () => service.submitJoinRequest(10, 55, 'Хочу приєднатись'),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.CAMPAIGN_FINISHED
  );
});

test('Cannot remove members from finished campaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'OWNER',
    requesterId: 1,
    campaignStatus: 'FINISHED',
    memberRecord: { userId: 55, role: 'PLAYER' },
  });

  await assert.rejects(
    () => service.removeMemberFromCampaign(10, 1, 55),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.CAMPAIGN_FINISHED
  );
});

test('Cannot update member role in finished campaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'OWNER',
    requesterId: 1,
    campaignStatus: 'FINISHED',
    memberRecord: { userId: 55, role: 'PLAYER' },
  });

  await assert.rejects(
    () => service.updateMemberRole(10, 1, 55, 'GM'),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.CAMPAIGN_FINISHED
  );
});

test('Cannot transfer ownership in finished campaign', async () => {
  const { service } = buildMembersServiceContext({
    requesterRole: 'OWNER',
    requesterId: 1,
    campaignStatus: 'FINISHED',
  });

  await assert.rejects(
    () => service.transferCampaignOwnership(10, 1, 2),
    (error) => error instanceof AppError
      && error.code === ERROR_CODES.CAMPAIGN_FINISHED
  );
});

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
