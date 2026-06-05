import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Dices } from 'lucide-react';
import useVttStore from '@/stores/useVttStore';

/**
 * Roll Maker — Панель налаштування кидка кубиків.
 * 
 * @param {function} onRoll - Callback функція (formula) => void, яка викликається при натисканні "Set"
 */
export default function RollMaker({ onRoll }) {
  const { isRollMakerOpen, setRollMakerOpen } = useVttStore();
  const [formula, setFormula] = useState('1d20');
  const [errorMsg, setErrorMsg] = useState(null);
  const containerRef = useRef(null);
  
  // Для спрощеної версії поки що лише базові типи кубиків
  const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isRollMakerOpen &&
        containerRef.current &&
        !containerRef.current.contains(event.target) &&
        !event.target.closest('[data-roll-maker-toggle]')
      ) {
        setRollMakerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isRollMakerOpen, setRollMakerOpen]);

  const handleRoll = () => {
    if (formula.trim() && onRoll) {
      let newFormula = formula;
      let wasModified = false;
      
      // З'єднуємо пробіли та приводимо всі варіанти до стандарту 'd'
      newFormula = newFormula.replace(/(\d*)\s*([dдкkвlлr])\s*(\d+)/gi, (match, count, letter, sides) => {
        return `${count || '1'}d${sides}`;
      });

      // Автоматичне виправлення: не більше 20 кубиків одного типу
      newFormula = newFormula.replace(/(\d+)[dдкkвlлr]\d+/gi, (match, countStr) => {
        const count = Number.parseInt(countStr, 10);
        if (count > 20) {
          wasModified = true;
          return match.replace(countStr, '20');
        }
        return match;
      });

      if (wasModified) {
        setFormula(newFormula);
        setErrorMsg('Ліміт 20 кубиків! Значення автоматично виправлено.');
        setTimeout(() => setErrorMsg(null), 3000);
        return; // Зупиняємо кидок, щоб користувач побачив виправлення
      }

      onRoll(newFormula, 'Fast Roll');
      setRollMakerOpen(false); // Автоматичне закриття після кидка
    }
  };

  const addDice = (dice) => {
    let current = formula.trim().replace(/^\/r(oll)?\s+/i, '');
    if (!current) {
      setFormula(`1${dice}`);
      return;
    }
    
    // Look for occurrences of this dice type. e.g. "1d6", "2d6"
    const regex = new RegExp(String.raw`(^|\+|-) *(\d*) *(${dice})\b`, 'i');
    const match = regex.exec(current);
    
    if (match) {
      const prefix = match[1]; // + or - or empty
      const countStr = match[2];
      const count = countStr ? Number.parseInt(countStr, 10) : 1;
      const newCount = Math.min(count + 1, 20); // Обмеження: макс 20 кубиків
      
      current = current.replace(regex, `${prefix} ${newCount}${dice}`);
    } else {
      current = `${current} + 1${dice}`;
    }
    
    // Clean up spaces
    current = current.replace(/\s+/g, ' ').trim();
    if (current.startsWith('+ ')) current = current.substring(2);
    
    setFormula(current);
  };

  return (
    <div 
      ref={containerRef}
      className={`absolute left-1/2 -translate-x-1/2 w-96 bg-brand-dark/95 backdrop-blur-md border border-brand-light/20 rounded-xl shadow-[0_8px_30px_rgba(22,74,65,0.6)] z-50 overflow-hidden flex flex-col text-sm text-white transition-all duration-300 ease-in-out ${
        isRollMakerOpen 
          ? 'bottom-24 opacity-100 pointer-events-auto translate-y-0' 
          : 'bottom-24 opacity-0 pointer-events-none translate-y-12'
      }`}
    >
      {/* Toast Notification */}
      <div 
        className={`absolute top-0 left-0 w-full px-4 py-3 bg-red-500/90 text-white text-center font-medium shadow-md transition-all duration-300 z-50 flex items-center justify-center ${
          errorMsg ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
        }`}
      >
        {errorMsg}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-light/10 bg-brand-medium/40">
        <h3 className="font-semibold flex items-center gap-2 text-brand-light">
          <Dices size={16} /> Roll Maker
        </h3>
        <button 
          onClick={setRollMakerOpen.bind(null, false)}
          className="text-brand-light/70 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-4">
        {/* Formula Input */}
        <div className="bg-brand-dark/50 border border-brand-light/20 rounded-lg p-3 flex items-center gap-2">
          <span className="text-brand-light/50 font-mono">/r</span>
          <input
            type="text"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            className="bg-transparent border-none outline-none flex-1 font-mono text-brand-accent placeholder:text-brand-light/30 min-w-0"
            placeholder="1d20+5"
          />
          {formula && (
            <button 
              onClick={() => setFormula('')} 
              className="text-white/40 hover:text-white transition-colors flex items-center justify-center p-1"
              title="Очистити формулу"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dice Selection */}
        <div>
          <div className="text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Dice Types</div>
          <div className="flex flex-wrap gap-2">
            {diceTypes.map((dice) => (
              <button
                key={dice}
                onClick={() => addDice(dice)}
                className="px-3 py-1.5 rounded-md bg-brand-medium/30 hover:bg-brand-medium/70 border border-brand-light/20 transition-colors font-mono text-xs text-brand-light hover:text-white"
              >
                {dice}
              </button>
            ))}
          </div>
        </div>

        {/* Visibility Mock */}
        <div className="flex items-center gap-2 text-xs text-brand-light/70">
          <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
          Everyone can see
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-brand-light/10 flex justify-end bg-brand-medium/20">
        <button
          onClick={handleRoll}
          className="px-6 py-2 bg-brand-accent hover:bg-[#d99f41] text-brand-dark font-bold rounded-lg transition-colors shadow-lg shadow-brand-accent/20"
        >
          Roll
        </button>
      </div>
    </div>
  );
}

RollMaker.propTypes = {
  onRoll: PropTypes.func
};
