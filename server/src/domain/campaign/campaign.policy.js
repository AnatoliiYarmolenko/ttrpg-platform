const {
  canDiscoverCampaign,
  canOpenCampaign,
  canManageCampaign,
  getCampaignJoinMode,
  campaignRequiresShareTokenForOutsider,
} = require('../access/access-rules');

function getCampaignViewerCapabilities(context = {}) {
  return {
    canDiscover: canDiscoverCampaign(context),
    canOpen: canOpenCampaign(context),
    canManage: canManageCampaign(context),
    joinMode: getCampaignJoinMode(context),
    requiresShareTokenForOutsider: campaignRequiresShareTokenForOutsider(context),
  };
}

module.exports = {
  canDiscoverCampaign,
  canOpenCampaign,
  canManageCampaign,
  getCampaignJoinMode,
  campaignRequiresShareTokenForOutsider,
  getCampaignViewerCapabilities,
};
