import React from 'react';
import PropTypes from 'prop-types';
import { SESSION_TABS, COMMUNICATION_MODES } from '../../constants/sessionTabs';
import SessionInfoWidget from '../widgets/SessionInfoWidget';
import SessionSettingsWidget from '../widgets/SessionSettingsWidget';
import SessionCommunicationCallWidget from '../widgets/SessionCommunicationCallWidget';
import SessionCommunicationChatWidget from '../widgets/SessionCommunicationChatWidget';
import SessionPageParticipantsWidget from '../widgets/SessionParticipantsWidget';
import TopBarTabButton from '@/components/ui/TopBarTabButton';

function renderCommunicationLeftPanel({ viewingUserId, profilePreviewNode }) {
  if (viewingUserId) {
    return profilePreviewNode;
  }

  return <SessionCommunicationCallWidget />;
}

const COMMUNICATION_TAB_OPTIONS = [
  { key: COMMUNICATION_MODES.CHAT, label: 'Чат' },
  { key: COMMUNICATION_MODES.PARTICIPANTS, label: 'Учасники' },
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

CommunicationModeSwitch.propTypes = {
  activeMode: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};


export default function SessionTabRenderer({
  activeTab,
  sessionInfoProps,
  sessionSettingsProps,
  participantsProps,
  viewingUserId,
  profilePreviewNode,
  communicationPanelMode,
  setCommunicationPanelMode,
}) {
  const detailsParticipantsProps = {
    ...participantsProps,
    canManage: false,
    canManageGmRequests: false,
  };

  if (activeTab === SESSION_TABS.SETTINGS) {
    return {
      leftPanel: <SessionSettingsWidget {...sessionSettingsProps} />,
      rightPanel: <SessionPageParticipantsWidget {...participantsProps} />,
    };
  }

  if (activeTab === SESSION_TABS.COMMUNICATION) {
    const isChatMode = communicationPanelMode === COMMUNICATION_MODES.CHAT;
    return {
      leftPanel: renderCommunicationLeftPanel({ viewingUserId, profilePreviewNode }),
      rightPanel: isChatMode ? (
        <SessionCommunicationChatWidget
          actions={(
            <CommunicationModeSwitch
              activeMode={communicationPanelMode}
              onChange={setCommunicationPanelMode}
            />
          )}
        />
      ) : (
        <SessionPageParticipantsWidget
          {...participantsProps}
          actions={(
            <CommunicationModeSwitch
              activeMode={communicationPanelMode}
              onChange={setCommunicationPanelMode}
            />
          )}
        />
      ),
    };
  }

  return {
    leftPanel: viewingUserId ? profilePreviewNode : <SessionInfoWidget {...sessionInfoProps} />,
    rightPanel: <SessionPageParticipantsWidget {...detailsParticipantsProps} />,
  };
}

