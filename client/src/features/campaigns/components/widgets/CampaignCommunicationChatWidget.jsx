import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { ChatPanel } from '@/features/chat/components';
import { useChatController } from '@/features/chat/hooks';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';

/**
 * CampaignCommunicationChatWidget — чат кампанії.
 *
 * Права панель таба "Деталі" у режимі CHAT.
 * Використовує useChatController для інтеграції data layer + UI.
 */
function CampaignCommunicationChatWidget({ actions }) {
  const { id: campaignId } = useParams();
  const user = useAuthStore(selectUser);
  const chatController = useChatController('campaign', Number.parseInt(campaignId, 10), {
    enabled: Boolean(user && campaignId),
  });

  const { disconnect } = chatController;

  // Cleanup на unmount — disconnect є стабільним useCallback ref
  useEffect(() => {
    return () => {
      disconnect?.();
    };
  }, [disconnect]);

  return (
    <ChatPanel
      {...chatController.chatPanelProps}
      actions={actions}
    />
  );
}

CampaignCommunicationChatWidget.propTypes = {
  actions: PropTypes.node,
};

export default CampaignCommunicationChatWidget;
