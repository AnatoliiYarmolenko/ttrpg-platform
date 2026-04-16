import React from 'react';
import { SESSION_TABS, COMMUNICATION_MODES } from '../../constants/sessionTabs';
import SessionInfoWidget from '../widgets/SessionInfoWidget';
import SessionSettingsWidget from '../widgets/SessionSettingsWidget';
import SessionCommunicationChatWidget from '../widgets/SessionCommunicationChatWidget';
import SessionCommunicationCallWidget from '../widgets/SessionCommunicationCallWidget';
import SessionPageParticipantsWidget from '../widgets/SessionParticipantsWidget';
import Button from '@/components/ui/Button';

function renderCommunicationLeftPanel({ viewingUserId, profilePreviewNode }) {
  if (viewingUserId) {
    return profilePreviewNode;
  }

  return <SessionCommunicationCallWidget />;
}

function renderCommunicationRightPanel({
  communicationPanelMode,
  setCommunicationPanelMode,
  participantsProps,
  sessionTitle,
}) {
  return (
    communicationPanelMode === COMMUNICATION_MODES.PARTICIPANTS ? (
      <SessionPageParticipantsWidget
        {...participantsProps}
        actions={(
          <Button
            onClick={() => setCommunicationPanelMode(COMMUNICATION_MODES.CHAT)}
            variant="primary"
            size="md"
            fullWidth={false}
            className="h-8 min-w-[140px]"
          >
            Повідомлення
          </Button>
        )}
      />
    ) : (
      <SessionCommunicationChatWidget
        sessionTitle={sessionTitle}
        onToggleMode={() => setCommunicationPanelMode(COMMUNICATION_MODES.PARTICIPANTS)}
      />
    )
  );
}

export default function SessionTabRenderer({
  activeTab,
  sessionInfoProps,
  sessionSettingsProps,
  participantsProps,
  viewingUserId,
  profilePreviewNode,
  communicationPanelMode,
  setCommunicationPanelMode,
  sessionTitle,
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
    return {
      leftPanel: renderCommunicationLeftPanel({ viewingUserId, profilePreviewNode }),
      rightPanel: renderCommunicationRightPanel({
        communicationPanelMode,
        setCommunicationPanelMode,
        participantsProps,
        sessionTitle,
      }),
    };
  }

  return {
    leftPanel: viewingUserId ? profilePreviewNode : <SessionInfoWidget {...sessionInfoProps} />,
    rightPanel: <SessionPageParticipantsWidget {...detailsParticipantsProps} />,
  };
}

