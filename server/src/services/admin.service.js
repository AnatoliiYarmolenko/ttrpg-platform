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
  // ============== СТАТИСТИКА ==============

  /**
   * Загальна статистика платформи
   */
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

  // ============== КОРИСТУВАЧІ ==============

  /**
   * Список користувачів з пагінацією та пошуком
   */
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

  /**
   * Деталі конкретного користувача
   */
  async getUserById(userId) {
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        role: true,
        emailVerified: true,
        timezone: true,
        language: true,
        createdAt: true,
        updatedAt: true,
        lastActiveAt: true,
        _count: {
          select: {
            campaignsOwned: true,
            campaignMembers: true,
            ownedSessions: true,
            sessionsJoined: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError(ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND, 'Користувача не знайдено');
    }

    return user;
  }

  // ============== КАМПАНІЇ ==============

  /**
   * Список кампаній з пагінацією та пошуком
   */
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

  /**
   * Деталі кампанії для адміна
   */
  async getCampaignById(campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: parseInt(campaignId) },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        system: true,
        status: true,
        visibility: true,
        inviteCode: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
        _count: {
          select: {
            sessions: true,
            joinRequests: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND, 'Кампанію не знайдено');
    }

    return campaign;
  }

  /**
   * Видалення кампанії адміністратором
   */
  async deleteCampaign(campaignId) {
    const id = parseInt(campaignId);

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

  // ============== СЕСІЇ ==============

  /**
   * Список сесій з пагінацією та фільтрами
   */
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
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Деталі сесії для адміна
   */
  async getSessionById(sessionId) {
    const session = await prisma.session.findUnique({
      where: { id: parseInt(sessionId) },
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
        updatedAt: true,
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
        campaign: {
          select: {
            id: true,
            title: true,
          },
        },
        participants: {
          select: {
            id: true,
            role: true,
            status: true,
            isGuest: true,
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.ADMIN_RESOURCE_NOT_FOUND, 'Сесію не знайдено');
    }

    return session;
  }

  /**
   * Видалення сесії адміністратором
   */
  async deleteSession(sessionId) {
    const id = parseInt(sessionId);

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
