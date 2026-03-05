function _getConfirmedGm(session) {
  return (
    session.participants?.find(
      (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
    ) || null
  );
}

function _isSessionOwner(session, userId) {
  return session.ownerId === userId;
}

function _isCampaignOwnerOverride(session, userId) {
  return Boolean(session.campaign?.ownerId && session.campaign.ownerId === userId);
}

function _canManageParticipants(session, userId) {
  const confirmedGm = _getConfirmedGm(session);

  if (confirmedGm) {
    return confirmedGm.userId === userId;
  }

  return _isSessionOwner(session, userId);
}

function _canChangeSessionStatus(session, userId) {
  const confirmedGm = _getConfirmedGm(session);
  return confirmedGm?.userId === userId;
}

function _canEditSessionSettings(session, userId) {
  return _isSessionOwner(session, userId);
}

function _requireSessionOwner(
  {
    AppError,
    ERROR_CODES,
  },
  session,
  userId,
  message = 'Тільки власник сесії може виконати цю дію'
) {
  if (!_isSessionOwner(session, userId)) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, message);
  }
}

module.exports = {
  _getConfirmedGm,
  _isSessionOwner,
  _isCampaignOwnerOverride,
  _canManageParticipants,
  _canChangeSessionStatus,
  _canEditSessionSettings,
  _requireSessionOwner,
};