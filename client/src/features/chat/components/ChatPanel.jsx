import React from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import { AlertCircle } from 'lucide-react';

/**
 * ChatPanel — основний контейнер для чату.
 * Складається з:
 * - Заголовка з іменем чату та іконою статусу
 * - Списку повідомлень
 * - Поля для вводу
 *
 * Показує статуси: connecting, reconnecting, connected, error, disconnected.
 */
export default function ChatPanel({
  messages = [],
  isLoadingMessages = false,
  isLoadingConnection = false,
  hasError = false,
  errorMessage = null,
  connectionState = 'disconnected', // connecting | reconnecting | connected | error | disconnected
  readonly = false,
  onSend,
  onLoadMore,
  isLoadingOlder = false,
  hasMoreMessages = true,
  actions = null,
  className = '',
}) {
  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'bg-amber-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Підключено';
      case 'connecting':
      case 'reconnecting':
        return 'Підключення...';
      case 'error':
        return 'Помилка';
      default:
        return 'Відключено';
    }
  };

  const panelTitle = (
    <div className="flex items-center gap-2">
      <span>Чат</span>
      <div className="relative group cursor-help flex items-center">
        <div
          className={`w-2.5 h-2.5 rounded-full ${getStatusColor()}`}
        />
        {/* Tooltip */}
        <div className="
          absolute top-full left-1/2 -translate-x-1/2 mt-2
          px-2 py-1
          bg-gray-800 text-white text-[10px] font-medium rounded shadow-lg
          opacity-0 group-hover:opacity-100 transition-opacity duration-200
          pointer-events-none whitespace-nowrap z-50
        ">
          Статус: {getStatusText()}
          {/* Маленький трикутник зверху */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-800"></div>
        </div>
      </div>
    </div>
  );

  const headerActions = actions && (
    <div className="flex items-center justify-end gap-2">
      {actions}
    </div>
  );

  const isInputDisabled = readonly || connectionState !== 'connected';

  return (
    <DashboardCard
      title={panelTitle}
      actions={headerActions}
      noScroll
      className={`flex flex-col h-full min-h-0 ${className}`}
    >
      <div className="flex flex-col h-full min-h-0 -mx-6 -mt-6">
        {hasError && connectionState === 'error' && (
          <div className="flex items-center gap-2 p-3 mx-4 mt-4 mb-2 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">
              {errorMessage || "Помилка з'єднання з чатом"}
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <ChatMessageList
            messages={messages}
            isLoading={isLoadingMessages}
            hasError={hasError && connectionState === 'error'}
            errorMessage={errorMessage}
            onLoadMore={onLoadMore}
            isLoadingOlder={isLoadingOlder}
            hasMoreMessages={hasMoreMessages}
            className="px-2 py-2"
          />
        </div>

        <div className="border-t border-brand-light/20 px-3 py-2 flex-shrink-0 bg-white -mb-10">
          <ChatInput
            onSend={onSend}
            readonly={isInputDisabled || readonly}
            isLoading={isLoadingConnection}
            placeholder={readonly ? 'Цей чат недоступний для редагування' : 'Введіть повідомлення...'}
          />
        </div>
      </div>
    </DashboardCard>
  );
}

ChatPanel.propTypes = {
  messages: PropTypes.arrayOf(PropTypes.object),
  isLoadingMessages: PropTypes.bool,
  isLoadingConnection: PropTypes.bool,
  hasError: PropTypes.bool,
  errorMessage: PropTypes.string,
  connectionState: PropTypes.oneOf(['connecting', 'reconnecting', 'connected', 'error', 'disconnected']),
  readonly: PropTypes.bool,
  onSend: PropTypes.func.isRequired,
  onLoadMore: PropTypes.func,
  isLoadingOlder: PropTypes.bool,
  hasMoreMessages: PropTypes.bool,
  actions: PropTypes.node,
  className: PropTypes.string,
};
