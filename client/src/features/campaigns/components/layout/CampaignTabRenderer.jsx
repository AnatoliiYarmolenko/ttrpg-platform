import React from 'react';
import { CAMPAIGN_TABS, CAMPAIGN_COMMUNICATION_MODES } from '../../constants/campaignTabs';
import CampaignInfoWidget from '../widgets/CampaignInfoWidget';
import CampaignMembersWidget from '../widgets/CampaignMembersWidget';
import CampaignCommunicationChatWidget from '../widgets/CampaignCommunicationChatWidget';
import CampaignNextSessionWidget from '../widgets/CampaignNextSessionWidget';
import CampaignSessionsWidget from '../widgets/CampaignSessionsWidget';
import CampaignSettingsWidget from '../widgets/CampaignSettingsWidget';
import Button from '@/components/ui/Button';

/**
 * CampaignTabRenderer — відповідає за рендеринг лівої та правої панелі
 * сторінки кампанії залежно від поточного табу.
 */
export default function CampaignTabRenderer({
  activeTab,
  campaignCommunicationMode,
  setCampaignCommunicationMode,
  // Props for widgets
  infoProps,
  membersProps,
  nextSessionProps,
  sessionsProps,
  settingsProps,
  viewingUserId,
  profilePreviewNode,
}) {
  switch (activeTab) {
    case CAMPAIGN_TABS.MANAGE:
      return {
        leftPanel: viewingUserId ? profilePreviewNode : <CampaignSettingsWidget {...settingsProps} />,
        rightPanel: <CampaignMembersWidget {...membersProps} />,
      };

    case CAMPAIGN_TABS.SESSIONS:
      return {
        leftPanel: <CampaignNextSessionWidget {...nextSessionProps} />,
        rightPanel: <CampaignSessionsWidget {...sessionsProps} />,
      };

    case CAMPAIGN_TABS.DETAILS:
    default:
      return {
        leftPanel: viewingUserId ? profilePreviewNode : <CampaignInfoWidget {...infoProps} />,
        rightPanel: campaignCommunicationMode === CAMPAIGN_COMMUNICATION_MODES.CHAT ? (
          <CampaignCommunicationChatWidget
            onToggleMode={() => setCampaignCommunicationMode(CAMPAIGN_COMMUNICATION_MODES.MEMBERS)}
          />
        ) : (
          <CampaignMembersWidget
            {...membersProps}
            actions={(
              <Button
                onClick={() => setCampaignCommunicationMode(CAMPAIGN_COMMUNICATION_MODES.CHAT)}
                variant="primary"
                size="md"
                fullWidth={false}
                className="h-8 min-w-[140px]"
              >
                Повідомлення
              </Button>
            )}
          />
        ),
      };
  }
}
