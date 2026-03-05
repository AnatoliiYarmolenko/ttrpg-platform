const { prisma } = require('../lib/prisma');

/**
 * SearchService — сервіс для пошуку публічних кампаній та сесій
 * 
 * Відповідає за:
 * - Пошук PUBLIC кампаній з фільтрацією та пагінацією
 * - Пошук PUBLIC сесій з фільтрацією та пагінацією
 */
class SearchService {
  /**
   * Пошук публічних кампаній
   * 
   * @param {Object} filters - Параметри пошуку
   * @param {string} filters.query - Пошуковий запит (по назві та описі)
   * @param {string} filters.system - Фільтр по системі (D&D 5e, Pathfinder тощо)
   * @param {number} filters.limit - Кількість результатів (default: 20)
   * @param {number} filters.offset - Offset для пагінації (default: 0)
   * @param {string} filters.sortBy - Сортування: 'newest' | 'popular' | 'title'
   * @returns {Promise<{campaigns: Array, total: number, hasMore: boolean}>}
   */
  async searchCampaigns({ query, system, limit = 20, offset = 0, sortBy = 'newest' }) {
    const where = {
      visibility: 'PUBLIC',
    };

    // Текстовий пошук по назві та опису
    if (query && query.trim()) {
      where.OR = [
        { title: { contains: query.trim(), mode: 'insensitive' } },
        { description: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    // Фільтр по системі
    if (system && system.trim()) {
      where.system = { contains: system.trim(), mode: 'insensitive' };
    }

    // Визначаємо сортування
    let orderBy = {};
    switch (sortBy) {
      case 'popular':
        // Сортуємо по кількості учасників (імітація популярності)
        orderBy = { members: { _count: 'desc' } };
        break;
      case 'title':
        orderBy = { title: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Паралельно отримуємо результати та підраховуємо загальну кількість
    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          owner: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          _count: {
            select: { sessions: true, members: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.campaign.count({ where }),
    ]);

    // Форматуємо результат для фронтенду
    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      imageUrl: campaign.imageUrl,
      system: campaign.system,
      visibility: campaign.visibility,
      owner: campaign.owner,
      membersCount: campaign._count.members,
      sessionsCount: campaign._count.sessions,
      createdAt: campaign.createdAt,
    }));

    return {
      campaigns: formattedCampaigns,
      total,
      hasMore: offset + campaigns.length < total,
      limit,
      offset,
    };
  }

  /**
   * Пошук публічних сесій
   * 
   * @param {Object} filters - Параметри пошуку
   * @param {string} filters.query - Пошуковий запит (по назві та описі)
   * @param {string} filters.system - Фільтр по системі (через кампанію)
   * @param {Date} filters.dateFrom - Фільтр: дата від
   * @param {Date} filters.dateTo - Фільтр: дата до
   * @param {number} filters.minPrice - Мінімальна ціна
   * @param {number} filters.maxPrice - Максимальна ціна
   * @param {boolean} filters.hasAvailableSlots - Тільки з вільними місцями
   * @param {boolean} filters.oneShot - Тільки one-shot (без кампанії)
   * @param {number} filters.limit - Кількість результатів (default: 20)
   * @param {number} filters.offset - Offset для пагінації (default: 0)
   * @param {string} filters.sortBy - Сортування: 'date' | 'price' | 'newest'
   * @returns {Promise<{sessions: Array, total: number, hasMore: boolean}>}
   */
  async searchSessions({
    query,
    system,
    dateFrom,
    dateTo,
    minPrice,
    maxPrice,
    hasAvailableSlots,
    oneShot,
    limit = 20,
    offset = 0,
    sortBy = 'date',
  }) {
    const where = {
      visibility: 'PUBLIC',
      status: { in: ['PLANNED', 'ACTIVE'] }, // Тільки активні/заплановані сесії
    };

    // Текстовий пошук по назві та опису
    if (query && query.trim()) {
      where.OR = [
        { title: { contains: query.trim(), mode: 'insensitive' } },
        { description: { contains: query.trim(), mode: 'insensitive' } },
      ];
    }

    // Фільтр по системі (через кампанію)
    if (system && system.trim()) {
      where.campaign = {
        system: { contains: system.trim(), mode: 'insensitive' },
      };
    }

    // Фільтр по даті
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        where.date.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.date.lte = new Date(dateTo);
      }
    } else {
      // За замовчуванням показуємо тільки майбутні сесії
      where.date = { gte: new Date() };
    }

    // Фільтр по ціні
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) {
        where.price.gte = minPrice;
      }
      if (maxPrice !== undefined) {
        where.price.lte = maxPrice;
      }
    }

    // Тільки one-shot
    if (oneShot === true) {
      where.campaignId = null;
    }

    // Визначаємо сортування
    let orderBy = {};
    switch (sortBy) {
      case 'price':
        orderBy = { price: 'asc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'date':
      default:
        orderBy = { date: 'asc' };
        break;
    }

    // Отримуємо сесії
    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        include: {
          owner: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          campaign: {
            select: { id: true, title: true, system: true },
          },
          participants: {
            select: { id: true, role: true, status: true },
          },
          _count: {
            select: { participants: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.session.count({ where }),
    ]);

    // Фільтрація по вільних місцях (після запиту, бо Prisma не підтримує такий фільтр)
    let filteredSessions = sessions;
    if (hasAvailableSlots === true) {
      filteredSessions = sessions.filter(session => {
        const confirmedParticipants = session.participants.filter(
          p => p.status === 'CONFIRMED' && p.role === 'PLAYER'
        ).length;
        return confirmedParticipants < session.maxPlayers;
      });
    }

    // Форматуємо результат для фронтенду
    const formattedSessions = filteredSessions.map(session => {
      const confirmedPlayers = session.participants.filter(
        p => p.status === 'CONFIRMED' && p.role === 'PLAYER'
      ).length;

      return {
        id: session.id,
        title: session.title,
        description: session.description,
        date: session.date,
        duration: session.duration,
        status: session.status,
        price: session.price,
        maxPlayers: session.maxPlayers,
        currentPlayers: confirmedPlayers,
        availableSlots: session.maxPlayers - confirmedPlayers,
        visibility: session.visibility,
        owner: session.owner,
        ownerId: session.ownerId,
        campaign: session.campaign,
        isOneShot: !session.campaignId,
        createdAt: session.createdAt,
      };
    });

    return {
      sessions: formattedSessions,
      total: hasAvailableSlots ? formattedSessions.length : total,
      hasMore: offset + formattedSessions.length < total,
      limit,
      offset,
    };
  }
}

module.exports = new SearchService();
