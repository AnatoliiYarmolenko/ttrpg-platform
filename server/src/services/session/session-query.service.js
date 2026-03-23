function createSessionQueryService({ prisma, AppError, ERROR_CODES }) {
  const parsePositiveInt = (value, label = 'ID') => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, `${label} повинен бути позитивним числом`);
    }

    return parsed;
  };

  const getSessionById = async (sessionId, userId = null) => {
    const sessionIdInt = parsePositiveInt(sessionId, 'ID сесії');

    const session = await prisma.session.findUnique({
      where: { id: sessionIdInt },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: { id: true, title: true, visibility: true, ownerId: true, status: true, system: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
          orderBy: { role: 'asc' },
        },
      },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Сесія не знайдена');
    }

    const isCampaignSession = Boolean(session.campaignId);
    const isParticipant = Boolean(
      userId && session.participants.some((participant) => participant.userId === userId)
    );
    const isOwner = Boolean(userId && session.ownerId === userId);
    const isCampaignOwner = Boolean(userId && session.campaign?.ownerId === userId);

    let isCampaignMember = false;
    if (isCampaignSession && userId) {
      const campaignMembership = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: session.campaignId,
          },
        },
        select: { userId: true },
      });

      isCampaignMember = Boolean(campaignMembership) || isCampaignOwner;
    }

    if (session.visibility === 'PRIVATE') {
      if (!userId) {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'У вас немає доступу до цієї сесії'
        );
      }

      const canAccessPrivateSession = !isCampaignSession
        || isParticipant
        || isOwner
        || isCampaignOwner
        || isCampaignMember;

      if (!canAccessPrivateSession) {
        throw new AppError(
          ERROR_CODES.SECURITY_ACCESS_DENIED,
          'У вас немає доступу до цієї сесії'
        );
      }
    }

    session.viewer = {
      isParticipant,
      isCampaignMember,
      isSessionOwner: isOwner,
      isCampaignOwner,
    };

    return session;
  };

  const resolveSessionContext = async (sessionId, userId, preloadedSession = null) => {
    const sessionIdInt = parsePositiveInt(sessionId, 'ID сесії');

    if (preloadedSession && preloadedSession.id === sessionIdInt) {
      return preloadedSession;
    }

    return getSessionById(sessionIdInt, userId);
  };

  return {
    parsePositiveInt,
    getSessionById,
    resolveSessionContext,
  };
}

module.exports = createSessionQueryService;