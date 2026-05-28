import React from 'react';
import PropTypes from 'prop-types';
import { ChatPanel } from '@/features/chat/components';

/**
 * SessionCommunicationChatWidget — чат сесії.
 *
 * Права панель таба "Комунікація" у режимі CHAT.
 * Приймає chatProps, які генеруються на рівні сторінки.
 */
function SessionCommunicationChatWidget({ chatProps, actions }) {
  return (
    <ChatPanel
      {...chatProps}
      actions={actions}
    />
  );
}

SessionCommunicationChatWidget.propTypes = {
  chatProps: PropTypes.object,
  actions: PropTypes.node,
};

export default SessionCommunicationChatWidget;
