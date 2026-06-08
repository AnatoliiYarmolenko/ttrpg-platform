import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Dices, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import useVttStore from '@/stores/useVttStore';
import QuickRollModal from './QuickRollModal';

/**
 * QuickBar — Нижня панель швидких дій.
 * Містить кнопку для відкриття Roll Maker та 8 слотів для збережених кидків.
 */
export default function QuickBar({ onRoll }) {
  const { toggleRollMaker, isRollMakerOpen, isQuickBarOpen, toggleQuickBar, quickRollsBySession, sessionId, setQuickRoll, clearQuickRoll } = useVttStore();
  
  const [editingSlotIndex, setEditingSlotIndex] = useState(null);

  const currentRolls = sessionId ? (quickRollsBySession[sessionId] || new Array(8).fill(null)) : new Array(8).fill(null);
  const slotIndices = [0, 1, 2, 3, 4, 5, 6, 7];

  const handleSlotClick = (index, rollData) => {
    if (rollData) {
      // Якщо слот заповнений, робимо кидок
      if (onRoll) {
        onRoll(rollData.formula, rollData.name);
      }
    } else {
      // Якщо порожній, відкриваємо модалку створення
      setEditingSlotIndex(index);
    }
  };

  const handleSlotContextMenu = (e, index) => {
    e.preventDefault(); // Зупиняємо стандартне контекстне меню браузера
    setEditingSlotIndex(index); // Відкриваємо модалку редагування
  };

  const handleSaveModal = (data) => {
    if (editingSlotIndex !== null) {
      setQuickRoll(editingSlotIndex, data);
    }
  };

  const handleClearModal = () => {
    if (editingSlotIndex !== null) {
      clearQuickRoll(editingSlotIndex);
    }
  };

  return (
    <>
      <div 
        className={`group absolute left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out z-40 ${
          isQuickBarOpen ? 'bottom-3' : '-bottom-[64px]'
        }`}
      >
        {/* Кнопка-язичок для відкриття/закриття */}
        <button 
          onClick={toggleQuickBar}
          className={`absolute left-1/2 -translate-x-1/2 w-16 h-6 bg-brand-dark/90 backdrop-blur-md border border-brand-light/20 border-b-0 rounded-t-lg flex items-center justify-center hover:bg-brand-medium/50 transition-all duration-300 ease-out text-brand-light hover:text-white shadow-xl -z-10 ${
            isQuickBarOpen 
              ? 'bottom-[calc(100%-12px)] opacity-0 group-hover:bottom-full group-hover:opacity-100' 
              : 'bottom-full opacity-100'
          }`}
          title={isQuickBarOpen ? "Сховати панель" : "Показати панель"}
        >
          {isQuickBarOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {/* Сама панель */}
        <div className="relative flex items-center gap-2 p-2 bg-brand-dark/90 backdrop-blur-md border border-brand-light/20 rounded-2xl shadow-[0_8px_30px_rgba(22,74,65,0.6)] z-10">
          
          {/* Заглушки для майбутніх слотів (Quick Slots) */}
          <div className="flex gap-2">
            {slotIndices.map((slotId) => {
              const roll = currentRolls[slotId];
              return (
                <div key={`quick-slot-${slotId}`} className="relative group/slot">
                  <button 
                    onClick={() => handleSlotClick(slotId, roll)}
                    onContextMenu={(e) => handleSlotContextMenu(e, slotId)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      roll 
                        ? 'bg-brand-medium/30 border border-brand-light/30 text-brand-light hover:bg-brand-medium/60 hover:text-white hover:border-brand-accent' 
                        : 'bg-brand-medium/10 border border-brand-light/10 text-brand-light/30 hover:bg-brand-medium/30 hover:text-brand-light/70'
                    }`}
                  >
                    {roll ? <Dices size={24} /> : <Plus size={20} />}
                  </button>

                  {/* Красивий тултіп при наведенні */}
                  {roll && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max max-w-[200px] bg-brand-dark/95 backdrop-blur-md border border-brand-light/20 rounded-lg p-3 shadow-2xl opacity-0 group-hover/slot:opacity-100 group-hover/slot:translate-y-0 translate-y-2 transition-all duration-200 pointer-events-none z-50">
                      <div className="font-bold text-white text-sm uppercase mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                        {roll.name}
                      </div>
                      <div className="text-brand-light text-xs font-mono mb-2">
                        Click to roll: <span className="text-brand-accent">[{roll.formula}]</span>
                      </div>
                      <div className="text-white/40 text-[10px] italic">
                        Right click to edit
                      </div>
                      {/* Хвостик тултіпа */}
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-dark/95 border-b border-r border-brand-light/20 rotate-45" />
                    </div>
                  )}
                  {!roll && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-brand-dark/95 backdrop-blur-md border border-brand-light/20 rounded-lg px-3 py-1.5 shadow-2xl opacity-0 group-hover/slot:opacity-100 group-hover/slot:translate-y-0 translate-y-2 transition-all duration-200 pointer-events-none z-50 text-white/70 text-xs whitespace-nowrap">
                      Додати кидок
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-brand-dark/95 border-b border-r border-brand-light/20 rotate-45" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Розділювач */}
          <div className="w-px h-8 bg-brand-light/20 mx-2" />
          
          {/* Кнопка Roll Maker */}
          <button
            data-roll-maker-toggle="true"
            onClick={toggleRollMaker}
            className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-200 ${
              isRollMakerOpen 
                ? 'bg-brand-accent text-brand-dark shadow-[0_0_15px_rgba(241,178,74,0.4)]' 
                : 'bg-brand-medium/30 text-brand-light hover:bg-brand-medium/60 hover:text-white'
            }`}
            title="Roll Maker (Свій кидок)"
          >
            <Dices size={24} />
          </button>
        </div>
      </div>

      <QuickRollModal
        isOpen={editingSlotIndex !== null}
        onClose={() => setEditingSlotIndex(null)}
        initialData={editingSlotIndex == null ? null : currentRolls[editingSlotIndex]}
        onSave={handleSaveModal}
        onClear={handleClearModal}
      />
    </>
  );
}

QuickBar.propTypes = {
  onRoll: PropTypes.func
};
