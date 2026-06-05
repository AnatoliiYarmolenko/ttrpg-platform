/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import PropTypes from 'prop-types';
import ChatMessageList from '@/features/chat/components/ChatMessageList';
import ChatInput from '@/features/chat/components/ChatInput';
import useVttStore from '@/stores/useVttStore';
import { X, MessageSquare, GripVertical, Loader2, Lock, Unlock } from 'lucide-react';
import useDraggablePanel from '../hooks/useDraggablePanel';

const MIN_WIDTH = 300;
const MIN_HEIGHT = 350;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 500;

export default function VttFloatingChat({ chatController }) {
  const { isChatOpen, toggleChat, floatingChatState, setFloatingChatState } = useVttStore();
  
  const {
    containerRef,
    isLocked,
    toggleLock,
    onDragMouseDown,
    onResizeMouseDown
  } = useDraggablePanel({
    initialState: floatingChatState,
    defaultWidth: DEFAULT_WIDTH,
    defaultHeight: DEFAULT_HEIGHT,
    defaultX: globalThis.window?.innerWidth ? globalThis.window.innerWidth - DEFAULT_WIDTH - 24 : 0,
    defaultY: globalThis.window?.innerHeight ? globalThis.window.innerHeight - DEFAULT_HEIGHT - 80 : 0,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    onSaveState: setFloatingChatState,
    isOpen: isChatOpen
  });

  const getStatusDot = () => {
    switch (chatController.connectionState) {
      case 'connected': return 'bg-green-400';
      case 'connecting':
      case 'reconnecting': return 'bg-amber-400 animate-pulse';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (!isChatOpen) return null;

  const { chatPanelProps } = chatController;
  const rh = 'absolute z-50 opacity-0 hover:opacity-100 transition-opacity';

  return (
    <div
      ref={containerRef}
      className="fixed z-50 flex flex-col rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.6)] border border-brand-light/20 will-change-transform"
      style={{ 
        left: 0, // Фіксуємо на 0, а рухаємо через transform
        top: 0, 
        background: 'rgba(22,36,34,0.5)', 
        backdropFilter: 'blur(24px)' 
      }}
    >
      {/* Resize handles */}
      {!isLocked && (
        <>
          <div onMouseDown={onResizeMouseDown('se')} className={`${rh} bottom-0 right-0 w-4 h-4 cursor-se-resize`} />
          <div onMouseDown={onResizeMouseDown('sw')} className={`${rh} bottom-0 left-0 w-4 h-4 cursor-sw-resize`} />
          <div onMouseDown={onResizeMouseDown('ne')} className={`${rh} top-0 right-0 w-4 h-4 cursor-ne-resize`} />
          <div onMouseDown={onResizeMouseDown('nw')} className={`${rh} top-0 left-0 w-4 h-4 cursor-nw-resize`} />
          <div onMouseDown={onResizeMouseDown('e')}  className={`${rh} top-4 right-0 bottom-4 w-2 cursor-e-resize`} />
          <div onMouseDown={onResizeMouseDown('w')}  className={`${rh} top-4 left-0 bottom-4 w-2 cursor-w-resize`} />
          <div onMouseDown={onResizeMouseDown('s')}  className={`${rh} left-4 right-4 bottom-0 h-2 cursor-s-resize`} />
          <div onMouseDown={onResizeMouseDown('n')}  className={`${rh} left-4 right-4 top-0 h-2 cursor-n-resize`} />
        </>
      )}

      {/* Header (drag zone) */}
      <div
        onMouseDown={onDragMouseDown}
        className={`flex items-center justify-between px-3 py-2.5 border-b border-brand-light/15 select-none flex-shrink-0 ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
        style={{ background: 'rgba(30,55,45,0.4)' }}
      >
        <div className={`flex items-center gap-2 ${isLocked ? 'opacity-50' : ''}`}>
          <GripVertical size={14} className="text-brand-light/30 pointer-events-none" />
          <MessageSquare size={16} className="text-brand-accent pointer-events-none" />
          <span className="text-white font-semibold text-sm pointer-events-none">Ігровий Чат</span>
          <div className={`w-2 h-2 rounded-full ml-1 ${getStatusDot()}`} title={chatController.connectionState} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleLock}
            className={`text-brand-light/50 hover:text-white transition-colors p-1 rounded ${isLocked ? 'text-amber-400 hover:text-amber-300' : ''}`}
            title={isLocked ? "Відкріпити (Unlock)" : "Закріпити (Lock)"}
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleChat}
            className="text-brand-light/50 hover:text-white transition-colors p-1 rounded"
            title="Закрити"
          >
            <X size={16} />
          </button>
        </div>
      </div>

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

      {/* Resize corner hint */}
      <div
        onMouseDown={onResizeMouseDown('se')}
        className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize flex items-end justify-end p-1 opacity-20 hover:opacity-60 transition-opacity"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 9L9 1M5 9L9 5M9 9V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-brand-light" />
        </svg>
      </div>
    </div>
  );
}

VttFloatingChat.propTypes = {
  chatController: PropTypes.object.isRequired,
};
