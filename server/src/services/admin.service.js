const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');
const { markUserAsBanned, unmarkUserAsBanned } = require('../store/banned-users');
const notificationService = require('./notification.service');
const { vttStateManager } = require('../vtt/vtt-state.manager');
const { logger } = require('../lib/logger');

class AdminService {
  async getStats() {
    const [usersCount, campaignsCount, sessionsCount, activeSessions] = await Promise.all([
      prisma.user.count(),
      prisma.campaign.count(),
      prisma.session.count(),
      prisma.session.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      users: usersCount,
      campaigns: campaignsCount,
      sessions: sessionsCount,
      activeSessions,
    };
  }

  async getUsers({ page = 1, limit = 20, search = '' }) {
    const skip = (page - 1) * limit;
    
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { displayName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          lastActiveAt: true,
          isBanned: true,
          bannedAt: true,
          _count: {
            select: {
              campaignsOwned: true,
              ownedSessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getCampaigns({ page = 1, limit = 20, search = '', visibility = '' }) {
    const skip = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { owner: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (visibility && ['PUBLIC', 'LINK_ONLY'].includes(visibility)) {
      where.visibility = visibility;
    }

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          system: true,
          status: true,
          visibility: true,
          createdAt: true,
          updatedAt: true,
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          _count: {
            select: {
              members: true,
              sessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteCampaign(campaignId) {
    const id = Number.parseInt(campaignId);

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND, 'Кампанію не знайдено');
    }

    await prisma.campaign.delete({ where: { id } });

    return { message: `Кампанію "${campaign.title}" видалено` };
  }

  async getSessions({ page = 1, limit = 20, search = '', status = '' }) {
    const skip = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { owner: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status && ['PLANNED', 'ACTIVE', 'FINISHED', 'CANCELED'].includes(status)) {
      where.status = status;
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          duration: true,
          status: true,
          visibility: true,
          system: true,
          price: true,
          maxPlayers: true,
          createdAt: true,
          owner: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
          campaign: {
            select: {
              id: true,
              title: true,
            },
          },
          _count: {
            select: {
              participants: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.session.count({ where }),
    ]);

    return {
      sessions: sessions.map(s => ({ ...s, startAt: s.date })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteSession(sessionId) {
    const id = Number.parseInt(sessionId);

    const session = await prisma.session.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND, 'Сесію не знайдено');
    }

    await prisma.session.delete({ where: { id } });

    return { message: `Сесію "${session.title}" видалено` };
  }

  async banUser(userId, adminId) {
    const targetUserId = Number.parseInt(userId, 10);
    const requestingAdminId = Number.parseInt(adminId, 10);

    if (targetUserId === requestingAdminId) {
      throw new AppError(ERROR_CODES.ADMIN_ACCESS_DENIED, 'Неможливо заблокувати самого себе');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, username: true },
    });

    if (!targetUser) {
      throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Користувача не знайдено');
    }

    if (targetUser.role === 'ADMIN') {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Неможливо заблокувати адміністратора');
    }

    const sessionsToCloseVtt = [];
    const notificationsToSend = [];

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: targetUserId },
        data: {
          isBanned: true,
          bannedAt: new Date(),
          telegramChatId: null,
          telegramLinkedAt: null,
        },
      });

      const pref = await tx.notificationPreference.findUnique({
        where: { userId: targetUserId },
      });

      if (pref?.enabledChannels) {
        let channels = pref.enabledChannels;
        if (!Array.isArray(channels)) {
          channels = [];
        }
        const newChannels = channels.filter((c) => c !== 'TELEGRAM');
        await tx.notificationPreference.update({
          where: { userId: targetUserId },
          data: { enabledChannels: newChannels },
        });
      }

      await tx.joinRequest.updateMany({
        where: { userId: targetUserId, status: 'PENDING' },
        data: { status: 'REJECTED' },
      });

      const ownedCampaigns = await tx.campaign.findMany({
        where: { ownerId: targetUserId },
        select: { id: true, title: true },
      });

      for (const campaign of ownedCampaigns) {
        await tx.campaign.update({
          where: { id: campaign.id },
          data: { status: 'FINISHED' },
        });

        const members = await tx.campaignMember.findMany({
          where: { campaignId: campaign.id, userId: { not: targetUserId } },
          select: { userId: true },
        });

        const memberIds = members.map((m) => m.userId);
        if (memberIds.length > 0) {
          notificationsToSend.push({
            type: 'campaign',
            targetId: campaign.id,
            title: campaign.title,
            recipientIds: memberIds,
          });
        }

        const campaignSessions = await tx.session.findMany({
          where: {
            campaignId: campaign.id,
            status: { in: ['PLANNED', 'ACTIVE'] },
          },
          select: { id: true, title: true },
        });

        for (const session of campaignSessions) {
          await tx.session.update({
            where: { id: session.id },
            data: { status: 'CANCELED' },
          });

          sessionsToCloseVtt.push(session.id);

          const participants = await tx.sessionParticipant.findMany({
            where: { sessionId: session.id, userId: { not: targetUserId } },
            select: { userId: true },
          });

          const participantIds = participants.map((p) => p.userId);
          if (participantIds.length > 0) {
            notificationsToSend.push({
              type: 'session',
              targetId: session.id,
              title: session.title,
              recipientIds: participantIds,
            });
          }
        }
      }

      const ownedOneShots = await tx.session.findMany({
        where: {
          ownerId: targetUserId,
          campaignId: null,
          status: { in: ['PLANNED', 'ACTIVE'] },
        },
        select: { id: true, title: true },
      });

      for (const session of ownedOneShots) {
        await tx.session.update({
          where: { id: session.id },
          data: { status: 'CANCELED' },
        });

        sessionsToCloseVtt.push(session.id);

        const participants = await tx.sessionParticipant.findMany({
          where: { sessionId: session.id, userId: { not: targetUserId } },
          select: { userId: true },
        });

        const participantIds = participants.map((p) => p.userId);
        if (participantIds.length > 0) {
          notificationsToSend.push({
            type: 'session',
            targetId: session.id,
            title: session.title,
            recipientIds: participantIds,
          });
        }
      }

      await tx.refreshToken.deleteMany({
        where: { userId: targetUserId },
      });
    });

    await markUserAsBanned(targetUserId);

    for (const sessionId of sessionsToCloseVtt) {
      try {
        vttStateManager.closeVtt(sessionId);
      } catch (err) {
        logger.error({ err, sessionId }, '[AdminService] Помилка закриття VTT для сесії');
      }
    }

    for (const notif of notificationsToSend) {
      try {
        if (notif.type === 'campaign') {
          await notificationService.createNotification({
            eventKey: `campaign_finished:${notif.targetId}`,
            type: 'CAMPAIGN_FINISHED',
            severity: 'INFO',
            category: 'campaign',
            title: 'Кампанію завершено',
            body: `Кампанію "${notif.title}" було завершено.`,
            link: `/campaign/${notif.targetId}`,
            recipientIds: notif.recipientIds,
            metadata: {
              campaignId: notif.targetId,
              campaignTitle: notif.title,
              status: 'FINISHED',
            },
          });
        } else if (notif.type === 'session') {
          await notificationService.createNotification({
            eventKey: `session_cancelled:${notif.targetId}`,
            type: 'SESSION_CANCELLED',
            severity: 'ERROR',
            category: 'session',
            title: 'Сесію скасовано',
            body: `Сесію "${notif.title}" скасовано.`,
            link: `/session/${notif.targetId}`,
            recipientIds: notif.recipientIds,
            metadata: {
              sessionId: notif.targetId,
              sessionTitle: notif.title,
              status: 'CANCELED',
            },
          });
        }
      } catch (err) {
        logger.error({ err, notif }, '[AdminService] Помилка відправки сповіщення');
      }
    }

    return { message: `Користувача "${targetUser.username}" успішно заблоковано` };
  }

  async unbanUser(userId) {
    const targetUserId = Number.parseInt(userId, 10);

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, isBanned: true },
    });

    if (!targetUser) {
      throw new AppError(ERROR_CODES.USER_NOT_FOUND, 'Користувача не знайдено');
    }

    if (!targetUser.isBanned) {
      return { message: `Користувач "${targetUser.username}" не є заблокованим` };
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        isBanned: false,
        bannedAt: null,
      },
    });

    await unmarkUserAsBanned(targetUserId);

    return { message: `Користувача "${targetUser.username}" успішно розблоковано` };
  }
}

module.exports = new AdminService();
