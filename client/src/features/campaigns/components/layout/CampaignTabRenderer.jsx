import React from 'react';
import { CAMPAIGN_TABS, CAMPAIGN_COMMUNICATION_MODES } from '../../constants/campaignTabs';
import CampaignInfoWidget from '../widgets/CampaignInfoWidget';
import CampaignMembersWidget from '../widgets/CampaignMembersWidget';
import CampaignCommunicationChatWidget from '../widgets/CampaignCommunicationChatWidget';
import CampaignNextSessionWidget from '../widgets/CampaignNextSessionWidget';
import CampaignSessionsWidget from '../widgets/CampaignSessionsWidget';
import CampaignSettingsWidget from '../widgets/CampaignSettingsWidget';
import TopBarTabButton from '@/components/ui/TopBarTabButton';

/**
 * CampaignTabRenderer — відповідає за рендеринг лівої та правої панелі
 * сторінки кампанії залежно від поточного табу.
 */
const COMMUNICATION_TAB_OPTIONS = [
  { key: CAMPAIGN_COMMUNICATION_MODES.CHAT, label: 'Чат' },
  { key: CAMPAIGN_COMMUNICATION_MODES.MEMBERS, label: 'Учасники' },
];

function CommunicationModeSwitch({ activeMode, onChange }) {
  return (
    <fieldset className="max-w-full overflow-x-auto" aria-label="Режим комунікації">
      <legend className="sr-only">Режим комунікації</legend>
      <div className="flex items-center gap-2 min-w-max">
        {COMMUNICATION_TAB_OPTIONS.map((tab) => (
          <TopBarTabButton
            key={tab.key}
            label={tab.label}
            isActive={activeMode === tab.key}
            onClick={() => onChange(tab.key)}
            className="py-2 px-4 text-sm"
          />
        ))}
      </div>
    </fieldset>
  );
}

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
    default: {
      const isChatMode = campaignCommunicationMode === CAMPAIGN_COMMUNICATION_MODES.CHAT;
      return {
        leftPanel: viewingUserId ? profilePreviewNode : <CampaignInfoWidget {...infoProps} />,
        rightPanel: isChatMode ? (
          <CampaignCommunicationChatWidget
            actions={(
              <CommunicationModeSwitch
                activeMode={campaignCommunicationMode}
                onChange={setCampaignCommunicationMode}
              />
            )}
          />
        ) : (
          <CampaignMembersWidget
            {...membersProps}
            actions={(
              <CommunicationModeSwitch
                activeMode={campaignCommunicationMode}
                onChange={setCampaignCommunicationMode}
              />
            )}
          />
        ),
      };
    }
  }
}
