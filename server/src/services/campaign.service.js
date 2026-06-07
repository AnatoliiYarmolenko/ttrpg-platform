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
const notificationService = require('./notification.service');

class CampaignService {
  constructor() {
    this.membersService = createCampaignMembersService({
      prisma,
      AppError,
      ERROR_CODES,
      getCampaignById: this.getCampaignById.bind(this),
      permissionHelpers,
      notificationService,
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

  _normalizeNullableString(value) {
    if (typeof value !== 'string') {
      return value;
    }

    const normalizedValue = value.trim();
    return normalizedValue === '' ? null : normalizedValue;
  }

  _assignIfOwn(target, source, field, normalize = (value) => value) {
    if (!Object.hasOwn(source, field)) {
      return;
    }

    target[field] = normalize(source[field]);
  }

  _buildCampaignUpdateData(updateData, nextStatus) {
    const campaignUpdateData = {};

    this._assignIfOwn(campaignUpdateData, updateData, 'title');
    this._assignIfOwn(campaignUpdateData, updateData, 'description', this._normalizeNullableString);
    this._assignIfOwn(campaignUpdateData, updateData, 'imageUrl', this._normalizeNullableString);
    this._assignIfOwn(campaignUpdateData, updateData, 'system', this._normalizeNullableString);
    this._assignIfOwn(campaignUpdateData, updateData, 'visibility');

    if (nextStatus !== undefined) {
      campaignUpdateData.status = nextStatus;
    }

    return campaignUpdateData;
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
        chat: {
          create: {},
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
      whereCondition.OR = [
        {
          members: {
            some: {
              userId,
              role: { not: 'OWNER' },
            },
          },
        },
        {
          joinRequests: {
            some: {
              userId,
              status: 'PENDING',
            },
          },
        },
      ];
    } else {
      whereCondition.OR = [
        {
          members: {
            some: { userId },
          },
        },
        {
          joinRequests: {
            some: {
              userId,
              status: 'PENDING',
            },
          },
        },
      ];
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
        joinRequests: {
          where: {
            userId,
            status: 'PENDING',
          },
          select: { id: true, status: true },
          take: 1,
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
      let myStatus = null;

      if (campaign.ownerId === userId) {
        myRole = 'OWNER';
        myStatus = 'CONFIRMED';
      } else {
        const myMembership = campaign.members?.find((member) => member.userId === userId);
        if (myMembership) {
          myRole = myMembership.role;
          myStatus = 'CONFIRMED';
        } else if (campaign.joinRequests?.length > 0) {
          myStatus = 'PENDING';
        }
      }

      return {
        ...campaign,
        myRole,
        myStatus,
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
            participants: {
              select: {
                role: true,
                status: true,
              },
            },
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

    let myJoinRequest = null;
    const isOwner = Boolean(userId && campaign.ownerId === userId);
    const isCampaignMember = Boolean(
      userId && campaign.members.some((member) => member.userId === userId)
    );

    if (userId && !isOwner && !isCampaignMember) {
      myJoinRequest = await prisma.joinRequest.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: campaign.id,
          },
        },
        select: { status: true },
      });
    }

    const pendingJoinRequestStatus = myJoinRequest?.status === 'PENDING'
      ? 'PENDING'
      : null;

    const accessContext = buildCampaignAccessContext({
      campaign,
      userId,
      hasValidShareToken: this._hasValidCampaignAccessToken(campaign, shareToken),
      isPendingJoinRequester: pendingJoinRequestStatus === 'PENDING',
    });
    const viewerCapabilities = getCampaignViewerCapabilities(accessContext);

    if (!viewerCapabilities.canOpen) {
      throw new AppError(
        ERROR_CODES.SECURITY_ACCESS_DENIED,
        'У вас немає доступу до цієї кампанії'
      );
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
    
    const updatedCampaign = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        SELECT visibility, "shareTokenHash" 
        FROM "Campaign" 
        WHERE id = ${campaignIdInt} 
        FOR UPDATE
      `;

      if (!rows || rows.length === 0) {
        throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 'Кампанія не знайдена');
      }

      const lockedCampaign = rows[0];

      const shareTokenUpdate = this._buildCampaignShareTokenUpdate({ ...campaign, visibility: lockedCampaign.visibility, shareTokenHash: lockedCampaign.shareTokenHash }, updateData.visibility);
      const campaignUpdateData = {
        ...this._buildCampaignUpdateData(updateData, nextStatus),
        ...(Object.hasOwn(shareTokenUpdate, 'shareTokenHash')
          ? {
            shareTokenHash: shareTokenUpdate.shareTokenHash,
            shareTokenEncrypted: shareTokenUpdate.shareTokenEncrypted,
            shareTokenCreatedAt: shareTokenUpdate.shareTokenCreatedAt,
          }
          : {}),
      };

      let result;

      if (isFinishingCampaign) {
        await tx.session.updateMany({
          where: {
            campaignId: campaignIdInt,
            status: 'ACTIVE',
          },
          data: { status: 'FINISHED' },
        });

        await tx.session.updateMany({
          where: {
            campaignId: campaignIdInt,
            status: 'PLANNED',
          },
          data: { status: 'CANCELED' },
        });

        result = await tx.campaign.update({
          where: { id: campaignIdInt },
          data: campaignUpdateData,
          include: {
            owner: { select: { id: true, username: true, displayName: true } },
            members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
          },
        });
      } else {
        result = await tx.campaign.update({
          where: { id: campaignIdInt },
          data: campaignUpdateData,
          include: {
            owner: { select: { id: true, username: true, displayName: true } },
            members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
          },
        });
      }

      if (shareTokenUpdate.rawToken) {
        result.shareToken = shareTokenUpdate.rawToken;
      }

      return result;
    });

    if (isFinishingCampaign) {
      prisma.campaignMember.findMany({
        where: { campaignId: campaignIdInt, userId: { not: userId } },
        select: { userId: true },
      }).then((members) => {
        const recipientIds = members.map((m) => m.userId);
        if (recipientIds.length > 0) {
          notificationService.createNotification({
            eventKey: `campaign_finished:${campaignIdInt}`,
            type: 'CAMPAIGN_FINISHED',
            severity: 'INFO',
            category: 'campaign',
            title: 'Кампанію завершено',
            body: `Кампанію "${updatedCampaign.title}" було завершено.`,
            link: `/campaign/${campaignIdInt}`,
            recipientIds,
            metadata: {
              campaignId: campaignIdInt,
              campaignTitle: updatedCampaign.title,
              status: 'FINISHED',
            },
          }).catch(() => {});
        }
      }).catch(() => {});
    }

    delete updatedCampaign.shareTokenHash;
    delete updatedCampaign.shareTokenEncrypted;
    delete updatedCampaign.shareTokenCreatedAt;

    return updatedCampaign;
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
    const campaignIdInt = Number.parseInt(campaignId, 10);
    const campaign = await this.getCampaignById(campaignIdInt, userId);

    this._requireCampaignOwner(campaign, userId, 'Тільки власник може оновлювати посилання доступу');

    if (campaign.status === 'FINISHED') {
      throw new AppError(
        ERROR_CODES.CAMPAIGN_FINISHED,
        'Неможливо оновити посилання завершеної кампанії'
      );
    }

    return await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw`
        SELECT visibility 
        FROM "Campaign" 
        WHERE id = ${campaignIdInt} 
        FOR UPDATE
      `;

      if (!rows || rows.length === 0) {
        throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 'Кампанія не знайдена');
      }

      const lockedCampaign = rows[0];

      if (lockedCampaign.visibility !== 'LINK_ONLY') {
        throw new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          'Посилання доступу можна оновить тільки для LINK_ONLY кампаній'
        );
      }

      const { rawToken, tokenHash, tokenEncrypted } = createRawEncryptedAndHashedShareToken();
      await tx.campaign.update({
        where: { id: campaignIdInt },
        data: {
          shareTokenHash: tokenHash,
          shareTokenEncrypted: tokenEncrypted,
          shareTokenCreatedAt: new Date(),
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      return {
        token: rawToken,
        campaignId: campaignIdInt,
        shareUrl: `${frontendUrl}/campaigns/share/${rawToken}`,
      };
    });
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

  async cancelJoinRequest(campaignId, userId) {
    return this.membersService.cancelJoinRequest(campaignId, userId);
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
