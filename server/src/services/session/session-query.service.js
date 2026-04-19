const { hashToken } = require('../../utils/token.helper');
const { buildSessionAccessContext } = require('../../domain/session/session-access.context');
const { getSessionViewerCapabilities } = require('../../domain/session/session.policy');

function createSessionQueryService({ prisma, AppError, ERROR_CODES }) {
  const parsePositiveInt = (value, label = 'ID') => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, `${label} повинен бути позитивним числом`);
    }

    return parsed;
  };

  const getSessionById = async (sessionId, userId = null, options = {}) => {
    const sessionIdInt = parsePositiveInt(sessionId, 'ID сесії');
    const { shareToken = null, campaignShareToken = null } = options;

    const session = await prisma.session.findUnique({
      where: { id: sessionIdInt },
      include: {
        owner: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        campaign: {
          select: {
            id: true,
            title: true,
            visibility: true,
            ownerId: true,
            status: true,
            system: true,
            shareTokenHash: true,
          },
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

    let isCampaignMember = false;
    if (session.campaignId && userId) {
      const campaignMembership = await prisma.campaignMember.findUnique({
        where: {
          userId_campaignId: {
            userId,
            campaignId: session.campaignId,
          },
        },
        select: { role: true },
      });

      isCampaignMember = Boolean(campaignMembership || session.campaign?.ownerId === userId);
    }

    const normalizedCampaignShareToken = String(campaignShareToken || '').trim();
    const hasValidCampaignShareToken = Boolean(
      session.campaignId
      && normalizedCampaignShareToken
      && session.campaign?.shareTokenHash
      && session.campaign.shareTokenHash === hashToken(normalizedCampaignShareToken)
    );

    const accessContext = buildSessionAccessContext({
      session,
      userId,
      hasValidShareToken: Boolean(
        shareToken
          && session.shareTokenHash
          && session.shareTokenHash === hashToken(String(shareToken).trim())
      ),
      hasValidCampaignShareToken,
      isCampaignMember,
    });
    const viewerCapabilities = getSessionViewerCapabilities(accessContext);

    if (!viewerCapabilities.canOpen) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED);
    }

    session.viewer = {
      isParticipant: accessContext.isParticipant,
      isCampaignMember: accessContext.isCampaignMember,
      isSessionOwner: accessContext.isOwner,
      isCampaignOwner: Boolean(userId && session.campaign?.ownerId === userId),
      hasValidCampaignShareToken: accessContext.hasValidCampaignShareToken,
      role: accessContext.role,
      participationStatus: accessContext.participationStatus,
      ...viewerCapabilities,
    };

    session.hasShareLink = Boolean(session.shareTokenEncrypted);

    if (session.campaign) {
      delete session.campaign.shareTokenHash;
    }

    delete session.shareTokenHash;
    delete session.shareTokenEncrypted;
    delete session.shareTokenCreatedAt;

    return session;
  };

  const getSessionByShareToken = async (rawToken, userId = null) => {
    const normalizedToken = String(rawToken || '').trim();

    if (!normalizedToken) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Недійсне посилання доступу');
    }

    const session = await prisma.session.findFirst({
      where: {
        visibility: 'LINK_ONLY',
        shareTokenHash: hashToken(normalizedToken),
      },
      select: { id: true },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Недійсне посилання доступу');
    }

    return getSessionById(session.id, userId, { shareToken: normalizedToken });
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
    getSessionByShareToken,
    resolveSessionContext,
  };
}

module.exports = createSessionQueryService;
