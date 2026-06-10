import React from 'react';
import useVttStore from '@/stores/useVttStore';
import { GripVertical } from 'lucide-react';
import DiceIcon from './DiceIcon';
import DraggablePanel from './common/DraggablePanel';

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
  const { isDiceLogOpen, toggleDiceLog, rollHistory, clearRollHistory } = useVttStore();

  return (
    <DraggablePanel
      isOpen={isDiceLogOpen}
      onClose={toggleDiceLog}
      title="Журнал кидків"
      icon={<GripVertical size={14} className="text-brand-light/30" />}
      storageKey="vtt_diceLogState"
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      defaultX={globalThis.window?.innerWidth ? globalThis.window.innerWidth - DEFAULT_WIDTH - 16 : 0}
      defaultY={16}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      headerContent={
        rollHistory.length > 0 && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={clearRollHistory}
            className="flex items-center gap-1 text-brand-light/70 hover:text-red-400 transition-colors px-1 text-[11px] font-bold"
            title="Очистити журнал"
          >
            Очистити
          </button>
        )
      }
    >
      {rollHistory.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-brand-light/50 text-sm italic">
          Поки немає кидків...
        </div>
      ) : (
        <div className="flex flex-col pb-2">
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
                      {roll.player ? `${roll.player}: ` : ''}{roll.name || 'БЕЗ НАЗВИ'}
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
    </DraggablePanel>
  );
}


