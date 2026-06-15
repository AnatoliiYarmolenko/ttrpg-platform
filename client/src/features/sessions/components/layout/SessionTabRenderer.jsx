import React from 'react';
import { SESSION_TABS } from '../../constants/sessionTabs';
import SessionInfoWidget from '../widgets/SessionInfoWidget';
import SessionSettingsWidget from '../widgets/SessionSettingsWidget';
import SessionCommunicationCallWidget from '../widgets/SessionCommunicationCallWidget';
import SessionCommunicationChatWidget from '../widgets/SessionCommunicationChatWidget';
import SessionPageParticipantsWidget from '../widgets/SessionParticipantsWidget';

function renderCommunicationLeftPanel({ viewingUserId, profilePreviewNode }) {
  if (viewingUserId) {
    return profilePreviewNode;
  }

  return <SessionCommunicationCallWidget />;
}

export default function SessionTabRenderer({
  activeTab,
  sessionInfoProps,
  sessionSettingsProps,
  participantsProps,
  viewingUserId,
  profilePreviewNode,
  chatProps,
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
      leftLabel: 'Керування',
      rightLabel: 'Учасники',
    };
  }

  if (activeTab === SESSION_TABS.COMMUNICATION) {
    return {
      leftLabel: viewingUserId ? 'Профіль' : 'Відеодзвінок',
      rightLabel: 'Чат',
      leftPanel: renderCommunicationLeftPanel({ viewingUserId, profilePreviewNode }),
      rightPanel: <SessionCommunicationChatWidget chatProps={chatProps} />,
    };
  }

  return {
    leftPanel: viewingUserId ? profilePreviewNode : <SessionInfoWidget {...sessionInfoProps} />,
    rightPanel: <SessionPageParticipantsWidget {...detailsParticipantsProps} />,
    leftLabel: viewingUserId ? 'Профіль' : 'Деталі',
    rightLabel: 'Учасники',
  };
}
