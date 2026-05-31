/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import ChatMessageList from '@/features/chat/components/ChatMessageList';
import ChatInput from '@/features/chat/components/ChatInput';
import useVttStore from '@/stores/useVttStore';
import { X, MessageSquare, GripVertical, Loader2, Lock, Unlock } from 'lucide-react';

const MIN_WIDTH = 300;
const MIN_HEIGHT = 350;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 500;

export default function VttFloatingChat({ chatController }) {
  const { isChatOpen, toggleChat, floatingChatState, setFloatingChatState } = useVttStore();
  const containerRef = useRef(null);

  // Поточний стан зберігаємо у Ref, щоб завжди мати доступ до актуальних значень без ререндерів
  const stateRef = useRef({
    x: floatingChatState?.x ?? (globalThis.window === undefined ? 0 : globalThis.window.innerWidth - DEFAULT_WIDTH - 24),
    y: floatingChatState?.y ?? (globalThis.window === undefined ? 0 : globalThis.window.innerHeight - DEFAULT_HEIGHT - 80),
    w: floatingChatState?.w ?? DEFAULT_WIDTH,
    h: floatingChatState?.h ?? DEFAULT_HEIGHT,
    isLocked: floatingChatState?.isLocked ?? false,
  });

  const [isLocked, setIsLocked] = useState(floatingChatState?.isLocked ?? false);

  // Для виклику одноразового ререндеру, якщо все ж треба (зараз не треба, бо ми оновлюємо DOM напряму)
  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    // renderTrigger використовується для синхронізації рендеру
  }, [renderTrigger]);

  // Refs для подій
  const action = useRef(null); // 'drag' | 'resize-se' | 'resize-nw' тощо
  const start = useRef({ mx: 0, my: 0, ox: 0, oy: 0, w: 0, h: 0 });
  const rafRef = useRef(null);

  // Функція прямого застосування стилів (найшвидший спосіб)
  const applyStyles = () => {
    if (!containerRef.current) return;
    const { x, y, w, h } = stateRef.current;
    // Використовуємо transform: translate3d для GPU-акселерації переміщення (це в 10 разів швидше за left/top)
    containerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    containerRef.current.style.width = `${w}px`;
    containerRef.current.style.height = `${h}px`;
  };

  // --- Drag ---
  const onDragMouseDown = useCallback((e) => {
    if (stateRef.current.isLocked || e.button !== 0) return;
    action.current = 'drag';
    start.current = { mx: e.clientX, my: e.clientY, ox: stateRef.current.x, oy: stateRef.current.y };
    e.preventDefault();
  }, []);

  // --- Resize ---
  const onResizeMouseDown = useCallback((direction) => (e) => {
    if (stateRef.current.isLocked || e.button !== 0) return;
    action.current = `resize-${direction}`;
    start.current = { mx: e.clientX, my: e.clientY, ox: stateRef.current.x, oy: stateRef.current.y, w: stateRef.current.w, h: stateRef.current.h };
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Глобальний обробник переміщення (через requestAnimationFrame для ідеальних 60FPS)
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!action.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - start.current.mx;
        const dy = e.clientY - start.current.my;
        
        if (action.current === 'drag') {
          // Обмеження екрану
          stateRef.current.x = Math.max(0, Math.min(globalThis.window.innerWidth - stateRef.current.w, start.current.ox + dx));
          stateRef.current.y = Math.max(0, Math.min(globalThis.window.innerHeight - 60, start.current.oy + dy));
        } else if (action.current.startsWith('resize-')) {
          const dir = action.current.replace('resize-', '');
          let newW = start.current.w;
          let newH = start.current.h;
          let newX = start.current.ox;
          let newY = start.current.oy;

          if (dir.includes('e')) newW = Math.max(MIN_WIDTH, start.current.w + dx);
          if (dir.includes('s')) newH = Math.max(MIN_HEIGHT, start.current.h + dy);
          if (dir.includes('w')) { 
            newW = Math.max(MIN_WIDTH, start.current.w - dx); 
            newX = start.current.ox + (start.current.w - newW); 
          }
          if (dir.includes('n')) { 
            newH = Math.max(MIN_HEIGHT, start.current.h - dy); 
            newY = start.current.oy + (start.current.h - newH); 
          }

          stateRef.current.w = newW;
          stateRef.current.h = newH;
          stateRef.current.x = newX;
          stateRef.current.y = newY;
        }

        applyStyles();
      });
    };

    const onMouseUp = () => {
      if (!action.current) return;
      action.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      
      // Зберігаємо стейт
      setFloatingChatState({ ...stateRef.current });
      // Просто форсуємо 1 ререндер щоб React запам'ятав позицію на випадок оновлення
      setRenderTrigger(n => n + 1);
    };

    globalThis.addEventListener('mousemove', onMouseMove, { passive: true });
    globalThis.addEventListener('mouseup', onMouseUp);
    return () => { 
      globalThis.removeEventListener('mousemove', onMouseMove); 
      globalThis.removeEventListener('mouseup', onMouseUp); 
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [setFloatingChatState]);

  // Встановлюємо початкові стилі при першому рендері або при forced render
  useEffect(() => {
    applyStyles();
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
        background: 'rgba(22,36,34,0.97)', 
        backdropFilter: 'blur(20px)' 
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
        style={{ background: 'rgba(30,55,45,0.8)' }}
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
            onClick={() => {
              const newLocked = !isLocked;
              setIsLocked(newLocked);
              stateRef.current.isLocked = newLocked;
              setFloatingChatState({ ...stateRef.current });
            }}
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
      <div className="flex-shrink-0 border-t border-brand-light/15 px-3 py-2 [&_textarea]:!bg-brand-medium/30 [&_textarea]:!text-white [&_textarea]:!placeholder-brand-light/50 [&_textarea]:!border-brand-light/20 [&_textarea:focus]:!border-brand-accent/50" style={{ background: 'rgba(20,40,30,0.8)' }}>
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
