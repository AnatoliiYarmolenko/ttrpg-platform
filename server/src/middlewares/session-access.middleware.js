const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');

function hasConfirmedGm(session, userId) {
  return session.participants?.some(
    (participant) =>
      participant.userId === userId
      && participant.role === 'GM'
      && participant.status === 'CONFIRMED'
  );
}

function isCampaignOwnerOverride(session, userId) {
  return Boolean(session.campaign?.ownerId && session.campaign.ownerId === userId);
}

async function loadSessionContext(req, res, next) {
  try {
    const sessionId = parseInt(req.params.id);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'ID сесії повинен бути позитивним числом');
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        date: true,
        duration: true,
        maxPlayers: true,
        visibility: true,
        campaign: {
          select: {
            id: true,
            ownerId: true,
          },
        },
        participants: {
          select: {
            id: true,
            userId: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Сесія не знайдена');
    }

    req.sessionContext = session;
    next();
  } catch (error) {
    next(error);
  }
}

function requireSessionOwner(req, res, next) {
  const userId = req.user?.id;
  const session = req.sessionContext;

  if (!session || session.ownerId !== userId) {
    return next(new AppError(ERROR_CODES.SESSION_OWNER_ONLY));
  }

  return next();
}

function requireConfirmedSessionGm(req, res, next) {
  const userId = req.user?.id;
  const session = req.sessionContext;

  if (!session || !hasConfirmedGm(session, userId)) {
    return next(new AppError(ERROR_CODES.SESSION_GM_ONLY));
  }

  return next();
}

function requireSessionOwnerOrGm(req, res, next) {
  const userId = req.user?.id;
  const session = req.sessionContext;

  if (!session) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED));
  }

  const isOwner = session.ownerId === userId;
  const isConfirmedGm = hasConfirmedGm(session, userId);

  if (!isOwner && !isConfirmedGm) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає прав для цієї дії')); 
  }

  return next();
}

function requireCampaignOwnerOverride(req, res, next) {
  const userId = req.user?.id;
  const session = req.sessionContext;

  if (!session || !isCampaignOwnerOverride(session, userId)) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED));
  }

  return next();
}

function requireSessionOwnerOrCampaignOwner(req, res, next) {
  const userId = req.user?.id;
  const session = req.sessionContext;

  if (!session) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED));
  }

  const isOwner = session.ownerId === userId;
  const isCampaignOwner = isCampaignOwnerOverride(session, userId);

  if (!isOwner && !isCampaignOwner) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає прав для цієї дії'));
  }

  return next();
}

function requireSessionOwnerOrGmOrCampaignOwner(req, res, next) {
  const userId = req.user?.id;
  const session = req.sessionContext;

  if (!session) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED));
  }

  const isOwner = session.ownerId === userId;
  const isConfirmedGm = hasConfirmedGm(session, userId);
  const isCampaignOwner = isCampaignOwnerOverride(session, userId);

  if (!isOwner && !isConfirmedGm && !isCampaignOwner) {
    return next(new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'У вас немає прав для цієї дії'));
  }

  return next();
}

module.exports = {
  loadSessionContext,
  requireSessionOwner,
  requireConfirmedSessionGm,
  requireSessionOwnerOrGm,
  requireCampaignOwnerOverride,
  requireSessionOwnerOrCampaignOwner,
  requireSessionOwnerOrGmOrCampaignOwner,
};