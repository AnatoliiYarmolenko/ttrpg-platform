function createCampaignMembersService({
  prisma,
  AppError,
  ERROR_CODES,
  getCampaignById,
  permissionHelpers,
  notificationService,
}) {
  const errorDeps = { AppError, ERROR_CODES };

  const assertCampaignNotFinished = (
    campaign,
    message = 'Кампанія завершена. Ця дія недоступна.'
  ) => {
    if (campaign?.status === 'FINISHED') {
      throw new AppError(ERROR_CODES.CAMPAIGN_FINISHED, message);
    }
  };

  // MVP-25: Send summary notification to campaign managers about new join requests
  async function notifyManagersAboutJoinRequest(campaign, userId) {
    if (!notificationService) return;

    const pendingCount = await prisma.joinRequest.count({
      where: {
        campaignId: campaign.id,
        status: 'PENDING',
      },
    });

    const managers = campaign.members.filter(
      (m) => m.role === 'OWNER' || m.role === 'GM'
    ).map((m) => m.userId);

    if (managers.length === 0) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, displayName: true },
    });

    const userName = user?.displayName || user?.username || 'Новий гравець';
    const campaignTitle = campaign.title || 'Нова кампанія';

    notificationService.createNotification({
      eventKey: `campaign_join_requests:${campaign.id}`,
      type: 'CAMPAIGN_JOIN_REQUESTS_UPDATED',
      severity: 'INFO',
      category: 'campaign',
      title: `До кампанії "${campaignTitle}" подано нові заявки`,
      body: `Очікує підтвердження: ${pendingCount}`,
      link: `/campaign/${campaign.id}`,
      recipientIds: managers,
      dedupeKey: `campaign:${campaign.id}:join_requests`,
      dedupeWindowMs: 10 * 60 * 1000, // 10 minutes
      metadata: {
        campaignId: campaign.id,
        pendingCount,
        requesterId: userId,
      },
    }).catch(() => {
      // Silently fail
    });
  }

  // MVP-26: Notify user about campaign participation confirmed
  async function notifyUserCampaignConfirmed(campaign, userId) {
    if (!notificationService) return;

    notificationService.createNotification({
      eventKey: `campaign_confirmed:${userId}:${campaign.id}`,
      type: 'CAMPAIGN_PARTICIPATION_CONFIRMED',
      severity: 'SUCCESS',
      category: 'campaign',
      title: 'Ви додані до кампанії',
      body: `Вас додано до кампанії "${campaign.title || 'Нова кампанія'}".`,
      link: `/campaign/${campaign.id}`,
      recipientIds: [userId],
      metadata: {
        campaignId: campaign.id,
        userId,
      },
    }).catch(() => {
      // Silently fail
    });
  }

  // MVP-27: Notify user about campaign participation declined
  async function notifyUserCampaignDeclined(campaignId, userId) {
    if (!notificationService) return;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true },
    });

    // Campaign may be deleted or user lost access - use fallback link
    const link = campaign ? `/campaign/${campaignId}` : '/';
    const campaignTitle = campaign?.title || 'Нова кампанія';

    notificationService.createNotification({
      eventKey: `campaign_declined:${userId}:${campaignId}`,
      type: 'CAMPAIGN_PARTICIPATION_DECLINED',
      severity: 'ERROR',
      category: 'campaign',
      title: 'Заявку відхилено',
      body: `Вашу заявку на кампанію "${campaignTitle}" відхилено.`,
      link,
      recipientIds: [userId],
      metadata: {
        campaignId,
        userId,
      },
    }).catch(() => {
      // Silently fail
    });
  }

  // MVP-28: Notify user about removal from campaign
  async function notifyUserCampaignRemoved(campaignId, userId) {
    if (!notificationService) return;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, title: true },
    });

    // User was removed - they don't have access to campaign page anymore
    const link = '/';
    const campaignTitle = campaign?.title || 'Нова кампанія';

    notificationService.createNotification({
      eventKey: `campaign_removed:${userId}:${campaignId}`,
      type: 'CAMPAIGN_MEMBER_REMOVED',
      severity: 'WARNING',
      category: 'campaign',
      title: 'Вас видалено з кампанії',
      body: `Вас видалено з кампанії "${campaignTitle}".`,
      link,
      recipientIds: [userId],
      metadata: {
        campaignId,
        userId,
      },
    }).catch(() => {
      // Silently fail
    });
  }

  const upsertJoinRequest = async (campaignId, userId, message = null) => {
    const existingRequest = await prisma.joinRequest.findUnique({
      where: {
        userId_campaignId: {
          userId,
          campaignId,
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Ви вже подали заявку на цю кампанію');
      }

      return prisma.joinRequest.update({
        where: { id: existingRequest.id },
        data: {
          status: 'PENDING',
          message,
          reviewedAt: null,
          reviewedBy: null,
          createdAt: new Date(),
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });
    }

    return prisma.joinRequest.create({
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
  };

  return {
    async transferCampaignOwnership(campaignId, currentOwnerId, newOwnerId) {
      const campaignIdInt = Number.parseInt(campaignId, 10);
      const newOwnerIdInt = Number.parseInt(newOwnerId, 10);

      if (!Number.isInteger(newOwnerIdInt) || newOwnerIdInt <= 0) {
        throw new AppError(ERROR_CODES.CAMPAIGN_TRANSFER_FAILED, 'Ідентифікатор нового власника має бути додатним числом');
      }

      if (currentOwnerId === newOwnerIdInt) {
        throw new AppError(ERROR_CODES.CAMPAIGN_TRANSFER_FAILED, 'Ви вже є власником цієї кампанії');
      }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        include: {
          members: {
            select: {
              userId: true,
              role: true,
            },
          },
        },
      });

      if (!campaign) {
        throw new AppError(ERROR_CODES.CAMPAIGN_TRANSFER_FAILED, 'Кампанія не знайдена');
      }

      assertCampaignNotFinished(
        campaign,
        'Не можна передавати власність у завершеній кампанії'
      );

      permissionHelpers._requireCampaignOwner(
        errorDeps,
        campaign,
        currentOwnerId,
        'Тільки власник може передавати права кампанії'
      );

      const pendingRequest = await prisma.joinRequest.findFirst({
        where: {
          campaignId: campaignIdInt,
          userId: newOwnerIdInt,
          status: 'PENDING',
        },
        select: { id: true },
      });

      if (pendingRequest) {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_TRANSFER_FAILED,
          'Не можна передати права кандидату з PENDING заявкою'
        );
      }

      const newOwnerMember = campaign.members.find((member) => member.userId === newOwnerIdInt);

      if (!newOwnerMember) {
        throw new AppError(ERROR_CODES.CAMPAIGN_TRANSFER_FAILED, 'Новий власник має бути членом кампанії');
      }

      if (!['PLAYER', 'GM', 'OWNER'].includes(newOwnerMember.role)) {
        throw new AppError(
          ERROR_CODES.CAMPAIGN_TRANSFER_FAILED,
          'Передача прав дозволена лише повноцінному member кампанії'
        );
      }

      await prisma.$transaction([
        prisma.campaign.update({
          where: { id: campaignIdInt },
          data: { ownerId: newOwnerIdInt },
        }),
        prisma.campaignMember.update({
          where: {
            userId_campaignId: {
              userId: newOwnerIdInt,
              campaignId: campaignIdInt,
            },
          },
          data: { role: 'OWNER' },
        }),
        prisma.campaignMember.update({
          where: {
            userId_campaignId: {
              userId: currentOwnerId,
              campaignId: campaignIdInt,
            },
          },
          data: { role: 'GM' },
        }),
      ]);

      return getCampaignById(campaignIdInt, newOwnerIdInt);
    },

    async getCampaignMembers(campaignId, userId) {
      const campaignIdInt = Number.parseInt(campaignId, 10);

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: { id: true, visibility: true, ownerId: true },
      });

      if (!campaign) {
        throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 'Кампанія не знайдена');
      }

      let isOwner = false;
      let requesterRole = null;

      if (userId) {
        isOwner = campaign.ownerId === userId;

        const memberRecord = await prisma.campaignMember.findUnique({
          where: {
            userId_campaignId: { userId, campaignId: campaignIdInt },
          },
          select: { role: true },
        });

        if (memberRecord) {
          requesterRole = memberRecord.role;
        }
      }

      const isMember = requesterRole !== null;
      if (campaign.visibility !== 'PUBLIC' && !isOwner && !isMember) {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає доступу до перегляду учасників');
      }

      const canSeeSensitiveData = isOwner || requesterRole === 'GM' || requesterRole === 'OWNER';

      return prisma.campaignMember.findMany({
        where: { campaignId: campaignIdInt },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              email: canSeeSensitiveData,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
    },

    async addMemberToCampaign(campaignId, userId, newMemberId, role = 'PLAYER') {
      const campaign = await getCampaignById(campaignId, userId);

      assertCampaignNotFinished(
        campaign,
        'Не можна додавати учасників до завершеної кампанії'
      );

      const requesterRole = permissionHelpers._requireCampaignRoles(
        errorDeps,
        campaign,
        userId,
        ['OWNER', 'GM'],
        'Ви не маєте права додавати учасників'
      );

      const normalizedRole = String(role || 'PLAYER').toUpperCase();
      const targetRole = requesterRole === 'GM' ? 'PLAYER' : normalizedRole;

      if (requesterRole === 'GM' && normalizedRole !== 'PLAYER') {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'Майстер може додавати до кампанії тільки гравців'
        );
      }

      const existingMember = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId: Number.parseInt(newMemberId, 10),
            campaignId: Number.parseInt(campaignId, 10),
          },
        },
      });

      if (existingMember) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Цей користувач вже член кампанії');
      }

      const userExists = await prisma.user.findUnique({
        where: { id: Number.parseInt(newMemberId, 10) },
      });

      if (!userExists) {
        throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Користувач не знайдений');
      }

      const member = await prisma.campaignMember.create({
        data: {
          userId: Number.parseInt(newMemberId, 10),
          campaignId: Number.parseInt(campaignId, 10),
          role: targetRole,
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      // MVP-26: Notify user about being added to campaign
      notifyUserCampaignConfirmed(campaign, Number.parseInt(newMemberId, 10));

      return member;
    },

    async removeMemberFromCampaign(campaignId, userId, memberId) {
      const campaign = await getCampaignById(campaignId, userId);
      const memberIdInt = Number.parseInt(memberId, 10);
      const campaignIdInt = Number.parseInt(campaignId, 10);

      assertCampaignNotFinished(
        campaign,
        'Не можна видаляти учасників із завершеної кампанії'
      );

      if (campaign.ownerId === userId && memberIdInt === userId) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Власник кампанії не може видаляти себе');
      }

      const member = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId: memberIdInt,
            campaignId: campaignIdInt,
          },
        },
      });

      if (!member) {
        throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Учасник не знайдений');
      }

      const isSelfRemoval = member.userId === userId;
      if (isSelfRemoval) {
        if (member.role === 'OWNER') {
          throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Власник кампанії не може видаляти себе');
        }

        await prisma.campaignMember.delete({
          where: {
            userId_campaignId: {
              userId: memberIdInt,
              campaignId: campaignIdInt,
            },
          },
        });

        // Self-removal: no notification needed
        return;
      }

      // MVP-28: Notify user about removal from campaign (manager action only)
      notifyUserCampaignRemoved(campaignIdInt, memberIdInt);

      const requesterRole = permissionHelpers._requireCampaignRoles(
        errorDeps,
        campaign,
        userId,
        ['OWNER', 'GM'],
        'Ви не маєте права видаляти учасників'
      );

      if (member.role === 'OWNER') {
        throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Неможливо видалити власника кампанії');
      }

      if (requesterRole === 'GM' && member.role !== 'PLAYER') {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'Майстер може видаляти з кампанії тільки гравців'
        );
      }

      await prisma.campaignMember.delete({
        where: {
          userId_campaignId: {
            userId: memberIdInt,
            campaignId: campaignIdInt,
          },
        },
      });
    },

    async updateMemberRole(campaignId, userId, memberId, newRole) {
      const campaign = await getCampaignById(campaignId, userId);

      assertCampaignNotFinished(
        campaign,
        'Не можна змінювати ролі в завершеній кампанії'
      );

      permissionHelpers._requireCampaignOwner(
        errorDeps,
        campaign,
        userId,
        'Тільки власник може змінювати ролі учасників'
      );

      const validRoles = ['GM', 'PLAYER'];
      if (!validRoles.includes(newRole)) {
        throw new AppError(ERROR_CODES.VALIDATION_INVALID_FORMAT, 'Невірна роль');
      }

      const memberIdInt = Number.parseInt(memberId, 10);
      const campaignIdInt = Number.parseInt(campaignId, 10);

      const targetMember = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId: memberIdInt,
            campaignId: campaignIdInt,
          },
        },
        select: { userId: true, role: true },
      });

      if (!targetMember) {
        throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Учасник не знайдений');
      }

      if (targetMember.role === 'OWNER' && newRole !== 'OWNER') {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Не можна змінити роль власника');
      }

      return prisma.campaignMember.update({
        where: {
          userId_campaignId: {
            userId: memberIdInt,
            campaignId: campaignIdInt,
          },
        },
        data: { role: newRole },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });
    },

    async submitJoinRequest(campaignId, userId, message = null, shareToken = null) {
      const campaignIdInt = Number.parseInt(campaignId, 10);

      const campaign = await getCampaignById(campaignIdInt, userId, shareToken);

      if (!campaign) {
        throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND, 'Кампанія не знайдена');
      }

      assertCampaignNotFinished(
        campaign,
        'Не можна подати заявку до завершеної кампанії'
      );

      const existingMember = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: campaignIdInt,
          },
        },
      });

      if (existingMember) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Ви вже член цієї кампанії');
      }

      const joinRequest = await upsertJoinRequest(campaignIdInt, userId, message);

      // MVP-25: Notify managers about new join request
      notifyManagersAboutJoinRequest(campaign, userId);

      return joinRequest;
    },

    async cancelJoinRequest(campaignId, userId) {
      const campaignIdInt = Number.parseInt(campaignId, 10);

      const joinRequest = await prisma.joinRequest.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: campaignIdInt,
          },
        },
        select: { id: true, status: true },
      });

      if (!joinRequest) {
        throw new AppError(ERROR_CODES.JOIN_REQUEST_NOT_FOUND);
      }

      if (joinRequest.status !== 'PENDING') {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Заявка вже оброблена');
      }

      await prisma.joinRequest.delete({
        where: { id: joinRequest.id },
      });
    },

    async getJoinRequests(campaignId, userId) {
      const campaign = await getCampaignById(campaignId, userId);

      permissionHelpers._requireCampaignRoles(
        errorDeps,
        campaign,
        userId,
        ['OWNER', 'GM'],
        'Ви не маєте права переглядати заявки'
      );

      return prisma.joinRequest.findMany({
        where: {
          campaignId: Number.parseInt(campaignId, 10),
          status: 'PENDING',
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    },

    async approveJoinRequest(requestId, userId, role = 'PLAYER') {
      const requestIdInt = Number.parseInt(requestId, 10);
      const joinRequest = await prisma.joinRequest.findUnique({
        where: { id: requestIdInt },
        select: { campaignId: true, userId: true, status: true },
      });

      if (!joinRequest) {
        throw new AppError(ERROR_CODES.JOIN_REQUEST_NOT_FOUND);
      }

      if (joinRequest.status !== 'PENDING') {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Заявка вже оброблена');
      }

      const campaign = await getCampaignById(joinRequest.campaignId, userId);

      assertCampaignNotFinished(
        campaign,
        'Не можна схвалювати заявки для завершеної кампанії'
      );

      const requesterRole = permissionHelpers._requireCampaignRoles(
        errorDeps,
        campaign,
        userId,
        ['OWNER', 'GM'],
        'Ви не маєте права схвалювати заявки'
      );

      const normalizedRole = String(role || 'PLAYER').toUpperCase();
      const targetRole = requesterRole === 'GM' ? 'PLAYER' : normalizedRole;

      if (requesterRole === 'GM' && normalizedRole !== 'PLAYER') {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'Майстер може схвалювати заявки тільки з роллю гравця'
        );
      }

      return prisma.$transaction(async (tx) => {
        const updateResult = await tx.joinRequest.updateMany({
          where: {
            id: requestIdInt,
            status: 'PENDING',
          },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: userId,
          },
        });

        if (updateResult.count === 0) {
          throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Заявка вже оброблена');
        }

        try {
          const member = await tx.campaignMember.create({
            data: {
              userId: joinRequest.userId,
              campaignId: joinRequest.campaignId,
              role: targetRole,
            },
            include: {
              user: {
                select: { id: true, username: true, displayName: true, avatarUrl: true },
              },
            },
          });

          // MVP-26: Notify user about confirmation
          notifyUserCampaignConfirmed(campaign, joinRequest.userId);

          return member;
        } catch (error) {
          if (error?.code === 'P2002') {
            const existingMember = await tx.campaignMember.findUnique({
              where: {
                userId_campaignId: {
                  userId: joinRequest.userId,
                  campaignId: joinRequest.campaignId,
                },
              },
              include: {
                user: {
                  select: { id: true, username: true, displayName: true, avatarUrl: true },
                },
              },
            });

            if (existingMember) {
              // MVP-26: Notify user even if already member (idempotent approval)
              notifyUserCampaignConfirmed(campaign, joinRequest.userId);
              return existingMember;
            }
          }

          throw error;
        }
      });
    },

    async rejectJoinRequest(requestId, userId) {
      const requestIdInt = Number.parseInt(requestId, 10);
      const joinRequest = await prisma.joinRequest.findUnique({
        where: { id: requestIdInt },
        select: { campaignId: true, userId: true, status: true },
      });

      if (!joinRequest) {
        throw new AppError(ERROR_CODES.JOIN_REQUEST_NOT_FOUND);
      }

      if (joinRequest.status !== 'PENDING') {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Заявка вже оброблена');
      }

      const campaign = await getCampaignById(joinRequest.campaignId, userId);

      permissionHelpers._requireCampaignRoles(
        errorDeps,
        campaign,
        userId,
        ['OWNER', 'GM'],
        'Ви не маєте права відхиляти заявки'
      );

      await prisma.joinRequest.delete({
        where: { id: requestIdInt },
      });

      // MVP-27: Notify user about rejection
      notifyUserCampaignDeclined(joinRequest.campaignId, joinRequest.userId);
    },
  };
}

module.exports = createCampaignMembersService;
