/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import useVttStore from '@/stores/useVttStore';
import { X, GripVertical, Lock, Unlock } from 'lucide-react';
import DiceIcon from './DiceIcon';

function getDiceResultClasses(v, isD20) {
  const isCritSuccess = isD20 && v === 20;
  const isCritFail = isD20 && v === 1;

  if (isCritSuccess) {
    return {
      textColor: 'text-brand-accent',
      iconColor: 'text-brand-accent',
      borderColor: 'border-brand-accent/50',
      bgColor: 'bg-brand-accent/10',
    };
  }

  if (isCritFail) {
    return {
      textColor: 'text-red-400',
      iconColor: 'text-red-400',
      borderColor: 'border-red-400/50',
      bgColor: 'bg-red-400/10',
    };
  }

  return {
    textColor: 'text-brand-light',
    iconColor: 'text-brand-light/50',
    borderColor: 'border-brand-light/20',
    bgColor: 'bg-brand-medium/10',
  };
}

function renderDiceDetails(d, di) {
  if (d.values && d.values.length > 0) {
    return d.values.map((v, vi) => {
      const isD20 = d.label?.toLowerCase().includes('d20');
      const { textColor, iconColor, borderColor, bgColor } = getDiceResultClasses(v, isD20);

      return (
        <div
          key={`die-${d.label || 'dice'}-${di}-${vi}`}
          className={`w-[28px] h-[34px] rounded ${bgColor} border ${borderColor} flex flex-col items-center justify-center transition-colors`}
        >
          <span className={`${textColor} font-bold text-[12px] leading-none mt-1`}>
            {d.sign === '-' ? '-' : ''}{v}
          </span>
          <span className={`${iconColor} text-[8px] leading-none mt-1`}>
            <DiceIcon label={d.label} size={10} />
          </span>
        </div>
      );
    });
  }
  return null;
}

const MIN_WIDTH = 250;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 450;

/**
 * DiceLogPanel — плаваючий журнал останніх 8 кидків.
 * Відкривається/закривається через бокове меню. Можна перетягувати та змінювати розмір.
 */
export default function DiceLogPanel() {
  const { isDiceLogOpen, toggleDiceLog, rollHistory, clearRollHistory, diceLogState, setDiceLogState } = useVttStore();
  const containerRef = useRef(null);

  // Поточний стан зберігаємо у Ref
  const stateRef = useRef({
    x: diceLogState?.x ?? (globalThis.window === undefined ? 0 : globalThis.window.innerWidth - DEFAULT_WIDTH - 16),
    y: diceLogState?.y ?? 16,
    w: diceLogState?.w ?? DEFAULT_WIDTH,
    h: diceLogState?.h ?? DEFAULT_HEIGHT,
    isLocked: diceLogState?.isLocked ?? false,
  });

  const [isLocked, setIsLocked] = useState(diceLogState?.isLocked ?? false);

  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    // renderTrigger використовується для синхронізації рендеру
  }, [renderTrigger]);

  // Refs для подій
  const action = useRef(null);
  const start = useRef({ mx: 0, my: 0, ox: 0, oy: 0, w: 0, h: 0 });
  const rafRef = useRef(null);

  // Функція прямого застосування стилів
  const applyStyles = () => {
    if (!containerRef.current) return;
    const { x, y, w, h } = stateRef.current;
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

  useEffect(() => {
    if (!isDiceLogOpen) return;
    
    // Якщо вікно було змінено і панель опинилася за межами, повертаємо її на екран
    const max_x = globalThis.window.innerWidth - stateRef.current.w;
    const max_y = globalThis.window.innerHeight - stateRef.current.h;
    if (stateRef.current.x > max_x) stateRef.current.x = Math.max(0, max_x);
    if (stateRef.current.y > max_y) stateRef.current.y = Math.max(0, max_y);
    applyStyles();
  }, [isDiceLogOpen]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!action.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const dx = e.clientX - start.current.mx;
        const dy = e.clientY - start.current.my;
        
        if (action.current === 'drag') {
          stateRef.current.x = Math.max(0, Math.min(globalThis.window.innerWidth - stateRef.current.w, start.current.ox + dx));
          stateRef.current.y = Math.max(0, Math.min(globalThis.window.innerHeight - 40, start.current.oy + dy));
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
      // Save state to store
      setDiceLogState({ ...stateRef.current });
      setRenderTrigger(n => n + 1);
    };

    globalThis.addEventListener('mousemove', onMouseMove, { passive: true });
    globalThis.addEventListener('mouseup', onMouseUp);
    return () => { 
      globalThis.removeEventListener('mousemove', onMouseMove); 
      globalThis.removeEventListener('mouseup', onMouseUp); 
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [setDiceLogState]);

  useEffect(() => {
    applyStyles();
  });

  if (!isDiceLogOpen) return null;

  const rh = 'absolute z-50 opacity-0 hover:opacity-100 transition-opacity';

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 flex flex-col rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] border border-brand-light/20 overflow-hidden will-change-transform"
      style={{ 
        left: 0, 
        top: 0,
        background: 'rgba(22,36,34,0.95)', // brand-dark with opacity
        backdropFilter: 'blur(12px)'
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

      {/* Header (Drag Zone) */}
      <div 
        onMouseDown={onDragMouseDown}
        className={`flex items-center justify-between px-3 py-2 border-b border-brand-light/10 flex-shrink-0 bg-brand-medium/20 select-none ${isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}`}
      >
        <div className={`flex items-center gap-2 text-brand-light font-bold text-sm pointer-events-none ${isLocked ? 'opacity-50' : ''}`}>
          <GripVertical size={14} className="text-brand-light/30" />
          <span>Журнал кидків</span>
        </div>
        <div className="flex items-center gap-2">
          {rollHistory.length > 0 && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={clearRollHistory}
              className="flex items-center gap-1 text-brand-light/70 hover:text-red-400 transition-colors px-1 text-[11px] font-bold"
              title="Очистити журнал"
            >
              Очистити
            </button>
          )}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => {
              const newLocked = !isLocked;
              setIsLocked(newLocked);
              stateRef.current.isLocked = newLocked;
              setDiceLogState({ ...stateRef.current });
            }}
            className={`text-brand-light/70 hover:text-white transition-colors p-1 ${isLocked ? 'text-amber-400 hover:text-amber-300' : ''}`}
            title={isLocked ? "Відкріпити (Unlock)" : "Закріпити (Lock)"}
          >
            {isLocked ? <Lock size={13} /> : <Unlock size={13} />}
          </button>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleDiceLog}
            className="text-brand-light/70 hover:text-white transition-colors p-1"
            title="Закрити"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Roll list */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-transparent">
        {rollHistory.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-brand-light/50 text-sm italic">
            Поки немає кидків...
          </div>
        ) : (
          <div className="flex flex-col pb-2">
            <div className="px-4 py-2 pt-3 text-brand-accent font-bold text-sm tracking-wide">
              Snakes
            </div>
            {rollHistory.map((roll, index) => (
              <div
                key={roll.id || index}
                className="px-4 py-1.5 hover:bg-brand-light/5 transition-colors"
              >
                {/* Name + Formula + Total */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-white font-bold text-[13px] uppercase truncate">
                        {roll.name || 'UNTITLED'}
                      </span>
                      <div className="h-[1px] flex-1 bg-brand-light/20 min-w-[10px]" />
                      <span className="text-white font-bold text-xl tabular-nums leading-none ml-1 flex-shrink-0">
                        {roll.total}
                      </span>
                    </div>
                    <div className="text-brand-light/50 text-[10px] font-bold mt-0.5 break-words">
                      {roll.formula}
                    </div>
                  </div>
                </div>

                {/* Dice details */}
                {roll.details?.some(d => d.values?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {roll.details.map((d, di) => renderDiceDetails(d, di))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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


