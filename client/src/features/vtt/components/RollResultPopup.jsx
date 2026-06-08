/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import useVttStore from '@/stores/useVttStore';
import { X } from 'lucide-react';
import DiceIcon from './DiceIcon';

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
    textColor: 'text-white',
    iconColor: 'text-brand-light/50',
    borderColor: 'border-brand-light/20',
    bgColor: 'bg-brand-medium/20',
  };
}

function renderDetailItem(d, di) {
  if (d.values && d.values.length > 0) {
    return d.values.map((v, vi) => {
      const isD20 = d.label?.toLowerCase().includes('d20');
      const isD2 = d.label?.toLowerCase().match(/d2$/) !== null;
      const { textColor, iconColor, borderColor, bgColor } = getDiceResultClasses(v, isD20, isD2);

      let displayValue = v;
      let textClass = "text-sm";
      if (isD2) {
        displayValue = v === 2 ? 'ТАК' : 'НІ';
        textClass = "text-[10px] tracking-tighter";
      }

      return (
        <div
          key={`die-${d.label || 'dice'}-${di}-${vi}`}
          className={`w-[34px] h-[40px] rounded-lg ${bgColor} border ${borderColor} flex flex-col items-center justify-center shadow-inner transition-colors`}
        >
          <span className={`${textColor} font-bold ${textClass} leading-none mt-1`}>{d.sign === '-' ? '-' : ''}{displayValue}</span>
          <span className={`${iconColor} text-[9px] leading-none mt-1 uppercase`}>
            <DiceIcon label={d.label} value={v} size={12} />
          </span>
        </div>
      );
    });
  }

  // Модифікатор
  return (
    <div
      key={`mod-${d.label || 'modifier'}-${d.sign || 'plus'}-${d.subtotal}`}
      className="h-[40px] px-2 rounded-lg bg-brand-medium/10 border border-brand-light/10 flex items-center justify-center"
    >
      <span className="text-brand-accent font-bold text-sm">{d.sign === '-' ? '-' : '+'}{d.values.length === 0 ? Math.abs(d.subtotal) : d.subtotal}</span>
    </div>
  );
}

/**
 * RollResultPopup — спливаюча картка результату кидка.
 * З'являється по центру екрана після кидка, зникає через 5 секунд.
 */
export default function RollResultPopup() {
  const { latestRoll, clearLatestRoll } = useVttStore();
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!latestRoll) {
      setVisible(false);
      setLeaving(false);
      return;
    }

    // Показуємо
    setLeaving(false);
    setVisible(true);

    // Через 5 секунд — починаємо анімацію зникнення
    const hideTimer = setTimeout(() => {
      setLeaving(true);
    }, 5000);

    // Через 5.5 секунд — повністю прибираємо
    const clearTimer = setTimeout(() => {
      clearLatestRoll();
    }, 5500);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [latestRoll, clearLatestRoll]);

  if (!visible || !latestRoll) return null;

  const { name, formula, total, details } = latestRoll;

  return (
    <div className={`fixed inset-0 z-[60] pointer-events-none flex items-start justify-center pt-[8vh] ${leaving ? 'animate-out fade-out slide-out-to-top-4 duration-500' : 'animate-in fade-in slide-in-from-top-4 duration-300'}`}>
      <div className="pointer-events-auto relative bg-brand-dark/95 backdrop-blur-md rounded-xl px-5 py-4 min-w-[280px] max-w-[500px] shadow-[0_12px_40px_rgba(0,0,0,0.8)] border border-brand-light/20">
        {/* Кнопка закриття */}
        <button
          onClick={() => { setLeaving(true); setTimeout(clearLatestRoll, 300); }}
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-brand-dark border border-brand-light/20 hover:border-brand-accent flex items-center justify-center text-brand-light hover:text-white hover:bg-brand-medium/50 transition-colors shadow-md"
        >
          <X size={14} strokeWidth={2.5} />
        </button>

        {/* Гравець та Ім'я кидка */}
        <div className="flex items-center gap-2 mb-1 truncate">
          {latestRoll.player && (
            <span className="text-brand-accent text-[12px] font-black uppercase tracking-widest">
              {latestRoll.player}
            </span>
          )}
          {name && (
            <>
              {latestRoll.player && <span className="text-brand-light/40">•</span>}
              <span className="text-brand-light/80 text-[13px] font-bold">
                {name}
              </span>
            </>
          )}
        </div>

        {/* Формула та результат */}
        <div className="flex items-center justify-between gap-3">
          <div className="font-black text-white text-[15px] uppercase tracking-wide truncate">
            {formula || 'UNTITLED'}
          </div>
          <div className="h-[1px] flex-1 bg-brand-light/20 min-w-[12px] mx-1" />
          <div className="text-brand-accent font-black text-3xl tabular-nums leading-none flex-shrink-0">
            {total}
          </div>
        </div>

        {/* Деталі кубиків */}
        {details && details.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {details.map((d, di) => renderDetailItem(d, di))}
          </div>
        )}
      </div>
    </div>
  );
}
