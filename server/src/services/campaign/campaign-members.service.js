function createCampaignMembersService({
  prisma,
  crypto,
  AppError,
  ERROR_CODES,
  getCampaignById,
  permissionHelpers,
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

  const membersService = {
    async transferCampaignOwnership(campaignId, currentOwnerId, newOwnerId) {
      const campaignIdInt = parseInt(campaignId);
      const newOwnerIdInt = parseInt(newOwnerId);

      if (!Number.isInteger(newOwnerIdInt) || newOwnerIdInt <= 0) {
        throw new AppError(ERROR_CODES.CAMPAIGN_TRANSFER_FAILED, 'newOwnerId повинен бути позитивним числом');
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
      const campaignIdInt = parseInt(campaignId);

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

      const members = await prisma.campaignMember.findMany({
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

      return members;
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
            userId: parseInt(newMemberId),
            campaignId: parseInt(campaignId),
          },
        },
      });

      if (existingMember) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Цей користувач вже член кампанії');
      }

      const userExists = await prisma.user.findUnique({
        where: { id: parseInt(newMemberId) },
      });

      if (!userExists) {
        throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Користувач не знайдений');
      }

      const member = await prisma.campaignMember.create({
        data: {
          userId: parseInt(newMemberId),
          campaignId: parseInt(campaignId),
          role: targetRole,
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      return member;
    },

    async removeMemberFromCampaign(campaignId, userId, memberId) {
      const campaign = await getCampaignById(campaignId, userId);
      const memberIdInt = parseInt(memberId);
      const campaignIdInt = parseInt(campaignId);

      assertCampaignNotFinished(
        campaign,
        'Не можна видаляти учасників із завершеної кампанії'
      );

      if (campaign.ownerId === userId && memberIdInt === userId) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'OWNER не може видаляти себе');
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
          throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'OWNER не може видаляти себе');
        }

        await prisma.campaignMember.delete({
          where: {
            userId_campaignId: {
              userId: memberIdInt,
              campaignId: campaignIdInt,
            },
          },
        });

        return;
      }

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

      if (requesterRole === 'GM') {
        if (member.role !== 'PLAYER') {
          throw new AppError(
            ERROR_CODES.SECURITY_ACCESS_DENIED,
            'Майстер може видаляти з кампанії тільки гравців'
          );
        }
      }

      await prisma.campaignMember.delete({
        where: {
          userId_campaignId: {
            userId: parseInt(memberId),
            campaignId: parseInt(campaignId),
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

      const memberIdInt = parseInt(memberId);
      const campaignIdInt = parseInt(campaignId);

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

      const updated = await prisma.campaignMember.update({
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

      return updated;
    },

    async regenerateInviteCode(campaignId, userId) {
      const campaign = await getCampaignById(campaignId, userId);

      permissionHelpers._requireCampaignOwner(
        errorDeps,
        campaign,
        userId,
        'Тільки власник може регенерувати код'
      );

      assertCampaignNotFinished(
        campaign,
        'Не можна оновлювати invite-код завершеної кампанії'
      );

      if (campaign.visibility === 'LINK_ONLY') {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Кампанії з обмеженим доступом не використовують invite-коди');
      }

      const newInviteCode = crypto.randomBytes(8).toString('hex');

      const updated = await prisma.campaign.update({
        where: { id: parseInt(campaignId) },
        data: { inviteCode: newInviteCode },
      });

      return updated;
    },

    async resolveInviteCode(inviteCode) {
      const campaign = await prisma.campaign.findUnique({
        where: { inviteCode },
        select: {
          id: true,
          title: true,
          status: true,
        },
      });

      if (!campaign) {
        throw new AppError('INVITE_CODE_INVALID', 'Невірний invite код');
      }

      return {
        campaignId: campaign.id,
        title: campaign.title,
        status: campaign.status,
      };
    },

    async joinByInviteCode(inviteCode, userId) {
      const campaign = await prisma.campaign.findUnique({
        where: { inviteCode },
        select: { id: true, visibility: true, title: true, ownerId: true, status: true },
      });

      if (!campaign) {
        throw new AppError('INVITE_CODE_INVALID', 'Невірний invite код');
      }

      assertCampaignNotFinished(
        campaign,
        'Не можна приєднатися до завершеної кампанії'
      );

      const existingMember = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: campaign.id,
          },
        },
      });

      if (existingMember) {
        throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Ви вже член цієї кампанії');
      }

      const member = await prisma.$transaction(async (tx) => {
        const createdMember = await tx.campaignMember.create({
          data: {
            userId,
            campaignId: campaign.id,
            role: 'PLAYER',
          },
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        });

        await tx.joinRequest.updateMany({
          where: {
            userId,
            campaignId: campaign.id,
            status: 'PENDING',
          },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: campaign.ownerId,
          },
        });

        return createdMember;
      });

      return member;
    },

    async submitJoinRequest(campaignId, userId, message = null) {
      const campaignIdInt = parseInt(campaignId);

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignIdInt },
        select: { id: true, visibility: true, ownerId: true, status: true },
      });

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

      return upsertJoinRequest(campaignIdInt, userId, message);
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

      const joinRequests = await prisma.joinRequest.findMany({
        where: {
          campaignId: parseInt(campaignId),
          status: 'PENDING',
        },
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return joinRequests;
    },

    async approveJoinRequest(requestId, userId, role = 'PLAYER') {
      const requestIdInt = parseInt(requestId);
      const joinRequest = await prisma.joinRequest.findUnique({
        where: { id: requestIdInt },
        select: { campaignId: true, userId: true, status: true },
      });

      if (!joinRequest) {
        throw new AppError('JOIN_REQUEST_NOT_FOUND', 'Заявка не знайдена');
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

      const member = await prisma.$transaction(async (tx) => {
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
          return await tx.campaignMember.create({
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
        } catch (error) {
          // If membership already exists due to a race, keep operation idempotent.
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
              return existingMember;
            }
          }

          throw error;
        }
      });

      return member;
    },

    async rejectJoinRequest(requestId, userId) {
      const requestIdInt = parseInt(requestId);
      const joinRequest = await prisma.joinRequest.findUnique({
        where: { id: requestIdInt },
        select: { campaignId: true, status: true },
      });

      if (!joinRequest) {
        throw new AppError('JOIN_REQUEST_NOT_FOUND', 'Заявка не знайдена');
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
    },
  };

  return membersService;
}

module.exports = createCampaignMembersService;