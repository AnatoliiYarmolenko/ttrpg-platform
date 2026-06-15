import React from 'react';
import { CAMPAIGN_TABS } from '../../constants/campaignTabs';
import CampaignInfoWidget from '../widgets/CampaignInfoWidget';
import CampaignMembersWidget from '../widgets/CampaignMembersWidget';
import CampaignCommunicationChatWidget from '../widgets/CampaignCommunicationChatWidget';
import CampaignNextSessionWidget from '../widgets/CampaignNextSessionWidget';
import CampaignSessionsWidget from '../widgets/CampaignSessionsWidget';
import CampaignSettingsWidget from '../widgets/CampaignSettingsWidget';

export default function CampaignTabRenderer({
  activeTab,
  infoProps,
  membersProps,
  nextSessionProps,
  sessionsProps,
  settingsProps,
  viewingUserId,
  profilePreviewNode,
  chatProps,
}) {
  switch (activeTab) {
    case CAMPAIGN_TABS.MANAGE:
      return {
        leftPanel: viewingUserId ? profilePreviewNode : <CampaignSettingsWidget {...settingsProps} />,
        rightPanel: <CampaignMembersWidget {...membersProps} />,
        leftLabel: viewingUserId ? 'Профіль' : 'Налаштування',
        rightLabel: 'Учасники',
      };

    case CAMPAIGN_TABS.SESSIONS:
      return {
        leftPanel: <CampaignNextSessionWidget {...nextSessionProps} />,
        rightPanel: <CampaignSessionsWidget {...sessionsProps} />,
        leftLabel: 'Наступна сесія',
        rightLabel: 'Сесії',
      };

    case CAMPAIGN_TABS.DETAILS:
    default:
      return {
        leftLabel: viewingUserId ? 'Профіль' : 'Деталі',
        rightLabel: 'Чат',
        leftPanel: viewingUserId ? profilePreviewNode : <CampaignInfoWidget {...infoProps} />,
        rightPanel: <CampaignCommunicationChatWidget chatProps={chatProps} />,
      };
  }
}
