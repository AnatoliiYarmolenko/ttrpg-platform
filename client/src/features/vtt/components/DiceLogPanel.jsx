/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import useVttStore from '@/stores/useVttStore';
import { X, GripVertical, Lock, Unlock } from 'lucide-react';
import DiceIcon from './DiceIcon';
import useDraggablePanel from '../hooks/useDraggablePanel';

function getDiceResultClasses(v, isD20, isD2) {
  if (isD2) {
    if (v === 2) {
      return {
        textColor: 'text-brand-accent',
        iconColor: 'text-brand-accent',
        borderColor: 'border-brand-accent/50',
        bgColor: 'bg-brand-accent/10',
      };
    } else {
      return {
        textColor: 'text-red-400',
        iconColor: 'text-red-400',
        borderColor: 'border-red-400/50',
        bgColor: 'bg-red-400/10',
      };
    }
  }

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
      const isD2 = d.label?.toLowerCase().match(/d2$/) !== null;
      const { textColor, iconColor, borderColor, bgColor } = getDiceResultClasses(v, isD20, isD2);

      let displayValue = v;
      let textClass = "text-[12px]";
      if (isD2) {
        displayValue = v === 2 ? 'ТАК' : 'НІ';
        textClass = "text-[9px] tracking-tighter";
      }

      return (
        <div
          key={`die-${d.label || 'dice'}-${di}-${vi}`}
          className={`w-[28px] h-[34px] rounded ${bgColor} border ${borderColor} flex flex-col items-center justify-center transition-colors`}
        >
          <span className={`${textColor} font-bold ${textClass} leading-none mt-1`}>
            {d.sign === '-' ? '-' : ''}{displayValue}
          </span>
          <span className={`${iconColor} text-[8px] leading-none mt-1`}>
            <DiceIcon label={d.label} value={v} size={10} />
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
  
  const {
    containerRef,
    isLocked,
    toggleLock,
    onDragMouseDown,
    onResizeMouseDown
  } = useDraggablePanel({
    initialState: diceLogState,
    defaultWidth: DEFAULT_WIDTH,
    defaultHeight: DEFAULT_HEIGHT,
    defaultX: globalThis.window?.innerWidth ? globalThis.window.innerWidth - DEFAULT_WIDTH - 16 : 0,
    defaultY: 16,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    onSaveState: setDiceLogState,
    isOpen: isDiceLogOpen
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
        background: 'rgba(22,36,34,0.5)', // semi-transparent brand-dark
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
            onClick={toggleLock}
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


