import React from 'react';
import PropTypes from 'prop-types';
import { ChatPanel } from '@/features/chat/components';

/**
 * CampaignCommunicationChatWidget — чат кампанії.
 *
 * Права панель таба "Деталі" у режимі CHAT.
 * Приймає chatProps, які генеруються на рівні сторінки.
 */
function CampaignCommunicationChatWidget({ chatProps, actions }) {
  return (
    <ChatPanel
      {...chatProps}
      actions={actions}
    />
  );
}

CampaignCommunicationChatWidget.propTypes = {
  chatProps: PropTypes.object,
  actions: PropTypes.node,
};

export default CampaignCommunicationChatWidget;
