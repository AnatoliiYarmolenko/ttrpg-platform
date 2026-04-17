const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');
const {
  hashToken,
  createRawEncryptedAndHashedShareToken,
  decryptShareToken,
} = require('../utils/token.helper');
const { frontendUrl } = require('../config/config');
const { buildCampaignAccessContext } = require('../domain/campaign/campaign-access.context');
const { getCampaignViewerCapabilities } = require('../domain/campaign/campaign.policy');

const permissionHelpers = require('./campaign/campaign-permission.helpers');
const createCampaignMembersService = require('./campaign/campaign-members.service');
const createCampaignPageService = require('./campaign/campaign-page.service');

class CampaignService {
  constructor() {
    this.membersService = createCampaignMembersService({
      prisma,
      AppError,
      ERROR_CODES,
      getCampaignById: this.getCampaignById.bind(this),
      permissionHelpers,
    });
    this.pageService = createCampaignPageService({
      getCampaignById: this.getCampaignById.bind(this),
      getCampaignByShareToken: this.getCampaignByShareToken.bind(this),
      getJoinRequests: this.membersService.getJoinRequests.bind(this.membersService),
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
    return {
      title: updateData.title,
      description: updateData.description,
      imageUrl: updateData.imageUrl,
      system: updateData.system,
      visibility: updateData.visibility,
      status: nextStatus,
    };
  }

  _hasValidCampaignAccessToken(campaign, rawToken = null) {
    const providedToken = String(rawToken || '').trim();

    if (!providedToken) {
      return false;
    }

    if (campaign.shareTokenHash && campaign.shareTokenHash === hashToken(providedToken)) {
      return true;
    }

    return false;
  }

  _buildCampaignShareTokenUpdate(existingCampaign, nextVisibility) {
    const targetVisibility = nextVisibility ?? existingCampaign.visibility;

    if (targetVisibility !== 'LINK_ONLY') {
      return {
        shareTokenHash: null,
        shareTokenEncrypted: null,
        shareTokenCreatedAt: null,
      };
    }

    const isEnteringLinkOnly = existingCampaign.visibility !== 'LINK_ONLY';
    const hasShareToken = Boolean(existingCampaign.shareTokenHash);

    if (isEnteringLinkOnly || !hasShareToken) {
      const { rawToken, tokenHash, tokenEncrypted } = createRawEncryptedAndHashedShareToken();
      return {
        rawToken,
        shareTokenHash: tokenHash,
        shareTokenEncrypted: tokenEncrypted,
        shareTokenCreatedAt: new Date(),
      };
    }

    return {};
  }

  async createCampaign(data) {
    const { title, description, imageUrl, system, visibility, ownerId } = data;

    const shareTokenData = visibility === 'LINK_ONLY'
      ? createRawEncryptedAndHashedShareToken()
      : null;

    const campaign = await prisma.campaign.create({
      data: {
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        system: system || null,
        visibility,
        shareTokenHash: shareTokenData?.tokenHash || null,
        shareTokenEncrypted: shareTokenData?.tokenEncrypted || null,
        shareTokenCreatedAt: shareTokenData ? new Date() : null,
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

    if (shareTokenData) {
      campaign.shareToken = shareTokenData.rawToken;
    }

    delete campaign.shareTokenHash;
    delete campaign.shareTokenEncrypted;
    delete campaign.shareTokenCreatedAt;

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
        _count: {
          select: {
            sessions: true,
            members: true,
          },
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
      return {
        ...campaign,
        myRole,
        sessionsCount: campaign._count?.sessions ?? campaign.sessions?.length ?? 0,
        membersCount: campaign._count?.members ?? campaign.members?.length ?? 0,
      };
    });
  }

  async getCampaignById(campaignId, userId = null, shareToken = null) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: Number.parseInt(campaignId, 10) },
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
          select: {
            id: true,
            title: true,
            description: true,
            date: true,
            system: true,
            status: true,
            visibility: true,
            maxPlayers: true,
            ownerId: true,
            _count: {
              select: { participants: true },
            },
            owner: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
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

    const accessContext = buildCampaignAccessContext({
      campaign,
      userId,
      hasValidShareToken: this._hasValidCampaignAccessToken(campaign, shareToken),
    });
    const viewerCapabilities = getCampaignViewerCapabilities(accessContext);

    if (!viewerCapabilities.canOpen) {
      throw new AppError(
        ERROR_CODES.SECURITY_ACCESS_DENIED,
        'У вас немає доступу до цієї кампанії'
      );
    }

    let pendingJoinRequestStatus = null;
    if (userId && !accessContext.isOwner && !accessContext.isCampaignMember) {
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
      isOwner: accessContext.isOwner,
      isMember: accessContext.isCampaignMember,
      role: accessContext.role,
      pendingJoinRequestStatus,
      ...viewerCapabilities,
    };

    const requesterRole = this._getRequesterCampaignRole(campaign, userId);
    const canSeeJoinRequests = requesterRole === 'OWNER' || requesterRole === 'GM';

    if (!canSeeJoinRequests) {
      delete campaign.joinRequests;
    }

    delete campaign.shareTokenHash;
    delete campaign.shareTokenEncrypted;
    delete campaign.shareTokenCreatedAt;

    return campaign;
  }

  async updateCampaign(campaignId, userId, updateData) {
    const campaign = await this.getCampaignById(campaignId, userId);

    this._requireCampaignOwner(campaign, userId, 'Тільки власник може оновлювати кампанію');

    const settingsFields = ['title', 'description', 'imageUrl', 'system', 'visibility'];
    const hasSettingsUpdate = settingsFields.some((field) =>
      Object.hasOwn(updateData, field)
    );
    let nextStatus;
    if (updateData.status !== undefined) {
      nextStatus = String(updateData.status).toUpperCase();
    }

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

    const campaignIdInt = Number.parseInt(campaignId, 10);
    const isFinishingCampaign = campaign.status !== 'FINISHED' && nextStatus === 'FINISHED';
    const shareTokenUpdate = this._buildCampaignShareTokenUpdate(campaign, updateData.visibility);
    const campaignUpdateData = {
      ...this._buildCampaignUpdateData(campaign, updateData, nextStatus),
      ...(Object.hasOwn(shareTokenUpdate, 'shareTokenHash')
        ? {
          shareTokenHash: shareTokenUpdate.shareTokenHash,
          shareTokenEncrypted: shareTokenUpdate.shareTokenEncrypted,
          shareTokenCreatedAt: shareTokenUpdate.shareTokenCreatedAt,
        }
        : {}),
    };

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

      if (shareTokenUpdate.rawToken) {
        updatedCampaign.shareToken = shareTokenUpdate.rawToken;
      }

      delete updatedCampaign.shareTokenHash;
      delete updatedCampaign.shareTokenEncrypted;
      delete updatedCampaign.shareTokenCreatedAt;

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

    if (shareTokenUpdate.rawToken) {
      updated.shareToken = shareTokenUpdate.rawToken;
    }

    delete updated.shareTokenHash;
    delete updated.shareTokenEncrypted;
    delete updated.shareTokenCreatedAt;

    return updated;
  }

  async getCampaignByShareToken(rawToken, userId = null) {
    const normalizedToken = String(rawToken || '').trim();

    if (!normalizedToken) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Недійсне посилання доступу');
    }

    const campaign = await prisma.campaign.findFirst({
      where: {
        visibility: 'LINK_ONLY',
        shareTokenHash: hashToken(normalizedToken),
      },
      select: { id: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Недійсне посилання доступу');
    }

    return this.getCampaignById(campaign.id, userId, normalizedToken);
  }

  async getCampaignPageById(campaignId, userId = null) {
    return this.pageService.getCampaignPageById(campaignId, userId);
  }

  async getCampaignPageByShareToken(rawToken, userId = null) {
    return this.pageService.getCampaignPageByShareToken(rawToken, userId);
  }

  async regenerateShareToken(campaignId, userId) {
    const campaign = await this.getCampaignById(campaignId, userId);

    this._requireCampaignOwner(campaign, userId, 'Тільки власник може оновлювати посилання доступу');

    if (campaign.visibility !== 'LINK_ONLY') {
      throw new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        'Посилання доступу доступне тільки для LINK_ONLY кампаній'
      );
    }

    if (campaign.status === 'FINISHED') {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_FINISHED,
        'Неможливо оновити посилання завершеної кампанії'
      );
    }

    const { rawToken, tokenHash, tokenEncrypted } = createRawEncryptedAndHashedShareToken();
    await prisma.campaign.update({
      where: { id: Number.parseInt(campaignId, 10) },
      data: {
        shareTokenHash: tokenHash,
        shareTokenEncrypted: tokenEncrypted,
        shareTokenCreatedAt: new Date(),
      },
    });

    return {
      token: rawToken,
      campaignId: Number.parseInt(campaignId, 10),
    };
  }

  async getCampaignShareLink(campaignId, userId) {
    const campaign = await this.getCampaignById(campaignId, userId);

    this._requireCampaignOwner(campaign, userId, 'Тільки власник може переглядати посилання доступу кампанії');

    if (campaign.visibility !== 'LINK_ONLY') {
      throw new AppError(ERROR_CODES.CAMPAIGN_SHARE_LINK_LINK_ONLY_REQUIRED);
    }

    const stored = await prisma.campaign.findUnique({
      where: { id: Number.parseInt(campaignId, 10) },
      select: { shareTokenEncrypted: true },
    });

    if (!stored?.shareTokenEncrypted) {
      throw new AppError(ERROR_CODES.CAMPAIGN_SHARE_LINK_UNAVAILABLE);
    }

    const token = decryptShareToken(stored.shareTokenEncrypted);

    return {
      token,
      shareUrl: `${frontendUrl}/campaign/share/${token}`,
    };
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

  async submitJoinRequest(campaignId, userId, message = null, shareToken = null) {
    return this.membersService.submitJoinRequest(campaignId, userId, message, shareToken);
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
