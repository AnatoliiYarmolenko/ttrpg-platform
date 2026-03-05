function _getRequesterCampaignRole(campaign, userId) {
  if (!userId) return null;
  if (campaign.ownerId === userId) return 'OWNER';
  const member = campaign.members?.find((entry) => entry.userId === userId);
  return member?.role ?? null;
}

function _requireCampaignOwner(
  {
    AppError,
    ERROR_CODES,
  },
  campaign,
  userId,
  message = 'Тільки власник може виконати цю дію'
) {
  if (!userId || campaign.ownerId !== userId) {
    throw new AppError(ERROR_CODES.CAMPAIGN_OWNER_REQUIRED, message);
  }
}

function _requireCampaignRoles(
  {
    AppError,
    ERROR_CODES,
  },
  campaign,
  userId,
  allowedRoles,
  message = 'У вас немає прав для виконання цієї дії'
) {
  const role = _getRequesterCampaignRole(campaign, userId);
  if (!role || !allowedRoles.includes(role)) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, message);
  }

  return role;
}

module.exports = {
  _getRequesterCampaignRole,
  _requireCampaignOwner,
  _requireCampaignRoles,
};