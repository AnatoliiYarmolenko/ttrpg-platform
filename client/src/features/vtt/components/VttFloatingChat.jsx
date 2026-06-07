import React from 'react';
import PropTypes from 'prop-types';
import ChatMessageList from '@/features/chat/components/ChatMessageList';
import ChatInput from '@/features/chat/components/ChatInput';
import useVttStore from '@/stores/useVttStore';
import { MessageSquare, GripVertical, Loader2 } from 'lucide-react';
import DraggablePanel from './common/DraggablePanel';

const MIN_WIDTH = 300;
const MIN_HEIGHT = 350;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 500;

export default function VttFloatingChat({ chatController }) {
  const { isChatOpen, toggleChat, floatingChatState, setFloatingChatState } = useVttStore();
  
  const { chatPanelProps } = chatController;

  const getStatusDot = () => {
    switch (chatController.connectionState) {
      case 'connected': return 'bg-green-400';
      case 'connecting':
      case 'reconnecting': return 'bg-amber-400 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <DraggablePanel
      isOpen={isChatOpen}
      onClose={toggleChat}
      title={
        <div className={`flex items-center gap-2 ${floatingChatState?.isLocked ? 'opacity-50' : ''}`}>
          <MessageSquare size={16} className="text-brand-accent pointer-events-none" />
          <span className="text-white font-semibold text-sm pointer-events-none">Ігровий Чат</span>
          <div className={`w-2 h-2 rounded-full ml-1 ${getStatusDot()}`} title={chatController.connectionState} />
        </div>
      }
      icon={<GripVertical size={14} className="text-brand-light/30 pointer-events-none" />}
      initialState={floatingChatState}
      onSaveState={setFloatingChatState}
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      defaultX={globalThis.window?.innerWidth ? globalThis.window.innerWidth - DEFAULT_WIDTH - 24 : 0}
      defaultY={globalThis.window?.innerHeight ? globalThis.window.innerHeight - DEFAULT_HEIGHT - 80 : 0}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
    >

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-hidden [&_.bg-gray-100]:!bg-brand-medium/30 [&_.bg-gray-100]:!border-brand-light/20 [&_.text-brand-dark]:!text-white [&_span.text-brand-medium\/80]:!text-brand-light/80 [&_.text-brand-medium\/70]:!text-brand-light/70 [&_p]:!text-white">
        {chatPanelProps.isLoadingMessages && chatPanelProps.messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-brand-light animate-spin" />
          </div>
        ) : (
          <ChatMessageList
            messages={chatPanelProps.messages}
            isLoading={chatPanelProps.isLoadingMessages}
            hasError={chatPanelProps.hasError}
            errorMessage={chatPanelProps.errorMessage}
            onLoadMore={chatPanelProps.onLoadMore}
            isLoadingOlder={chatPanelProps.isLoadingOlder}
            hasMoreMessages={chatPanelProps.hasMoreMessages}
            className="px-3 py-2 h-full"
          />
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-brand-light/15 px-3 py-2 [&_textarea]:!bg-brand-medium/30 [&_textarea]:!text-white [&_textarea]:!placeholder-brand-light/50 [&_textarea]:!border-brand-light/20 [&_textarea:focus]:!border-brand-accent/50" style={{ background: 'rgba(20,40,30,0.4)' }}>
        <ChatInput
          onSend={chatPanelProps.onSend}
          readonly={chatPanelProps.readonly || chatController.connectionState !== 'connected'}
          isLoading={chatPanelProps.isLoadingConnection}
          placeholder={
            chatController.connectionState === 'connected'
              ? 'Введіть повідомлення...'
              : 'Підключення до чату...'
          }
        />
      </div>
    </DraggablePanel>
  );
}

VttFloatingChat.propTypes = {
  chatController: PropTypes.object.isRequired,
};
