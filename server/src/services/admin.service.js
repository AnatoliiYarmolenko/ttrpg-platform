/**
 * Admin Service
 * Бізнес-логіка для адміністративних операцій
 * 
 * Відповідає за:
 * - Перегляд списків користувачів, кампаній, сесій (з пагінацією та пошуком)
 * - Видалення/модерацію кампаній та сесій
 * - Загальну статистику платформи
 */

const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');

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

    // Видаляємо кампанію (каскадно видаляє members, joinRequests)
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

    // Видаляємо сесію (каскадно видаляє participants)
    await prisma.session.delete({ where: { id } });

    return { message: `Сесію "${session.title}" видалено` };
  }
}

module.exports = new AdminService();
