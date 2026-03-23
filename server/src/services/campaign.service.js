const { prisma } = require('../lib/prisma');
const crypto = require('crypto');
const { AppError, ERROR_CODES } = require('../constants/errors');

const permissionHelpers = require('./campaign/campaign-permission.helpers');
const createCampaignMembersService = require('./campaign/campaign-members.service');

class CampaignService {
  constructor() {
    this.membersService = createCampaignMembersService({
      prisma,
      crypto,
      AppError,
      ERROR_CODES,
      getCampaignById: this.getCampaignById.bind(this),
      permissionHelpers,
    });
  }

  _getRequesterCampaignRole(campaign, userId) {
    return permissionHelpers._getRequesterCampaignRole(campaign, userId);
  }

  _requireCampaignOwner(campaign, userId, message = 'Тільки власник може виконати цю дію') {
    return permissionHelpers._requireCampaignOwner(
      { AppError, ERROR_CODES },
      campaign,
      userId,
      message
    );
  }

  _requireCampaignRoles(
    campaign,
    userId,
    allowedRoles,
    message = 'У вас немає прав для виконання цієї дії'
  ) {
    return permissionHelpers._requireCampaignRoles(
      { AppError, ERROR_CODES },
      campaign,
      userId,
      allowedRoles,
      message
    );
  }

  _buildCampaignUpdateData(existingCampaign, updateData, nextStatus) {
    const shouldRegenerateInviteCode = updateData.visibility === 'LINK_ONLY'
      && existingCampaign.visibility !== 'LINK_ONLY';

    return {
      title: updateData.title !== undefined ? updateData.title : undefined,
      description: updateData.description !== undefined ? updateData.description : undefined,
      imageUrl: updateData.imageUrl !== undefined ? updateData.imageUrl : undefined,
      system: updateData.system !== undefined ? updateData.system : undefined,
      visibility: updateData.visibility !== undefined ? updateData.visibility : undefined,
      status: nextStatus !== undefined ? nextStatus : undefined,
      ...(shouldRegenerateInviteCode && {
        inviteCode: crypto.randomBytes(8).toString('hex'),
      }),
    };
  }

  async createCampaign(data) {
    const { title, description, imageUrl, system, visibility, ownerId } = data;

    const inviteCode = visibility === 'LINK_ONLY'
      ? crypto.randomBytes(8).toString('hex')
      : null;

    const campaign = await prisma.campaign.create({
      data: {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        system: system || null,
        visibility,
        inviteCode,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return campaign;
  }

  async getMyCampaigns(userId, role = 'all') {
    const whereCondition = {};

    if (role === 'owner') {
      whereCondition.ownerId = userId;
    } else if (role === 'member') {
      whereCondition.members = {
        some: {
          userId,
          role: { not: 'OWNER' },
        },
      };
    } else {
      whereCondition.members = {
        some: { userId },
      };
    }

    const campaigns = await prisma.campaign.findMany({
      where: whereCondition,
      include: {
        owner: {
          select: { id: true, username: true, displayName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
        sessions: {
          select: { id: true, title: true, date: true, status: true },
          orderBy: { date: 'asc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((campaign) => {
      let myRole = null;
      if (campaign.ownerId === userId) {
        myRole = 'OWNER';
      } else {
        const myMembership = campaign.members?.find((member) => member.userId === userId);
        myRole = myMembership?.role || null;
      }
      return { ...campaign, myRole };
    });
  }

  async getCampaignById(campaignId, userId = null, inviteCode = null) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { role: 'asc' },
        },
        sessions: {
          select: { id: true, title: true, date: true, status: true, maxPlayers: true, ownerId: true },
          orderBy: { date: 'asc' },
        },
        joinRequests: {
          where: { status: 'PENDING' },
          select: { id: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 'Кампанія не знайдена');
    }

    let isOwner = false;
    let isMember = false;

    if (userId) {
      isOwner = campaign.ownerId === userId;
      isMember = campaign.members.some((member) => member.userId === userId);
    }

    const providedInviteCode = String(inviteCode || '').trim();
    const hasValidInviteCode =
      campaign.visibility === 'LINK_ONLY'
      && providedInviteCode.length > 0
      && campaign.inviteCode === providedInviteCode;

    if (campaign.visibility === 'LINK_ONLY') {
      if (!userId || (!isOwner && !isMember && !hasValidInviteCode)) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає доступу до цієї кампанії');
      }
    }

    let pendingJoinRequestStatus = null;
    if (userId && !isOwner && !isMember) {
      const myJoinRequest = await prisma.joinRequest.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: campaign.id,
          },
        },
        select: { status: true },
      });

      if (myJoinRequest?.status === 'PENDING') {
        pendingJoinRequestStatus = 'PENDING';
      }
    }

    campaign.viewer = {
      pendingJoinRequestStatus,
    };

    const requesterRole = this._getRequesterCampaignRole(campaign, userId);
    const canSeeJoinRequests = requesterRole === 'OWNER' || requesterRole === 'GM';
    const canSeeInviteCode = requesterRole === 'OWNER';

    if (!canSeeJoinRequests) {
      delete campaign.joinRequests;
    }

    if (!canSeeInviteCode) {
      delete campaign.inviteCode;
    }

    return campaign;
  }

  async updateCampaign(campaignId, userId, updateData) {
    const campaign = await this.getCampaignById(campaignId, userId);

    this._requireCampaignOwner(campaign, userId, 'Тільки власник може оновлювати кампанію');

    const settingsFields = ['title', 'description', 'imageUrl', 'system', 'visibility'];
    const hasSettingsUpdate = settingsFields.some((field) =>
      Object.prototype.hasOwnProperty.call(updateData, field)
    );
    const nextStatus = updateData.status !== undefined
      ? String(updateData.status).toUpperCase()
      : undefined;

    if (campaign.status === 'FINISHED' && hasSettingsUpdate) {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_FINISHED,
        'Неможливо змінювати налаштування завершеної кампанії'
      );
    }

    if (nextStatus !== undefined) {
      if (!['ACTIVE', 'FINISHED'].includes(nextStatus)) {
        throw new AppError(ERROR_CODES.VALIDATION_INVALID_FORMAT, 'Невірний статус кампанії');
      }

      if (campaign.status === 'FINISHED' && nextStatus !== 'FINISHED') {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_FINISHED,
          'Неможливо змінити статус завершеної кампанії'
        );
      }
    }

    const campaignIdInt = parseInt(campaignId);
    const isFinishingCampaign = campaign.status !== 'FINISHED' && nextStatus === 'FINISHED';
    const campaignUpdateData = this._buildCampaignUpdateData(campaign, updateData, nextStatus);

    if (isFinishingCampaign) {
      const [, , updatedCampaign] = await prisma.$transaction([
        prisma.session.updateMany({
          where: {
            campaignId: campaignIdInt,
            status: 'ACTIVE',
          },
          data: {
            status: 'FINISHED',
          },
        }),
        prisma.session.updateMany({
          where: {
            campaignId: campaignIdInt,
            status: 'PLANNED',
          },
          data: {
            status: 'CANCELED',
          },
        }),
        prisma.campaign.update({
          where: { id: campaignIdInt },
          data: campaignUpdateData,
          include: {
            owner: {
              select: { id: true, username: true, displayName: true },
            },
            members: {
              include: {
                user: {
                  select: { id: true, username: true, displayName: true },
                },
              },
            },
          },
        }),
      ]);

      return updatedCampaign;
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignIdInt },
      data: campaignUpdateData,
      include: {
        owner: {
          select: { id: true, username: true, displayName: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
          },
        },
      },
    });

    return updated;
  }

  async transferCampaignOwnership(campaignId, currentOwnerId, newOwnerId) {
    return this.membersService.transferCampaignOwnership(campaignId, currentOwnerId, newOwnerId);
  }

  async getCampaignMembers(campaignId, userId) {
    return this.membersService.getCampaignMembers(campaignId, userId);
  }

  async addMemberToCampaign(campaignId, userId, newMemberId, role = 'PLAYER') {
    return this.membersService.addMemberToCampaign(campaignId, userId, newMemberId, role);
  }

  async removeMemberFromCampaign(campaignId, userId, memberId) {
    return this.membersService.removeMemberFromCampaign(campaignId, userId, memberId);
  }

  async updateMemberRole(campaignId, userId, memberId, newRole) {
    return this.membersService.updateMemberRole(campaignId, userId, memberId, newRole);
  }

  async regenerateInviteCode(campaignId, userId) {
    return this.membersService.regenerateInviteCode(campaignId, userId);
  }

  async resolveInviteCode(inviteCode) {
    return this.membersService.resolveInviteCode(inviteCode);
  }

  async joinByInviteCode(inviteCode, userId) {
    return this.membersService.joinByInviteCode(inviteCode, userId);
  }

  async submitJoinRequest(campaignId, userId, message = null) {
    return this.membersService.submitJoinRequest(campaignId, userId, message);
  }

  async getJoinRequests(campaignId, userId) {
    return this.membersService.getJoinRequests(campaignId, userId);
  }

  async approveJoinRequest(requestId, userId, role = 'PLAYER') {
    return this.membersService.approveJoinRequest(requestId, userId, role);
  }

  async rejectJoinRequest(requestId, userId) {
    return this.membersService.rejectJoinRequest(requestId, userId);
  }
}

module.exports = new CampaignService();