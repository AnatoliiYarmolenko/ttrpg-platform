import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { ChatPanel } from '@/features/chat/components';
import { useChatController } from '@/features/chat/hooks';
import useAuthStore, { selectUser } from '@/stores/useAuthStore';

/**
 * SessionCommunicationChatWidget — чат сесії.
 *
 * Права панель таба "Комунікація" у режимі CHAT.
 * Використовує useChatController для інтеграції data layer + UI.
 */
function SessionCommunicationChatWidget({ actions }) {
  const { id: sessionId } = useParams();
  const user = useAuthStore(selectUser);
  const chatController = useChatController('session', Number.parseInt(sessionId, 10), {
    enabled: Boolean(user && sessionId),
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

SessionCommunicationChatWidget.propTypes = {
  actions: PropTypes.node,
};

export default SessionCommunicationChatWidget;

