import { useState } from 'react';
import useInitiativeStore from '@/stores/useInitiativeStore';
import useVttStore from '@/stores/useVttStore';
import useVttConnection from '../hooks/useVttConnection';
import DraggablePanel from './common/DraggablePanel';
import { RefreshCw, Plus, Trash2, Undo2 } from 'lucide-react';

export default function InitiativeTracker() {
  const { sessionId, isInitiativeTrackerOpen, initiativeTrackerOpenTrigger, toggleInitiativeTracker } = useVttStore();
  const { entries, prevTurn, nextTurn, addEmptyTurn, clear, removeTurn } = useInitiativeStore();
  const { sendVttInitiativeUpdate } = useVttConnection(sessionId, { enabled: !!sessionId });

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');

  if (!isInitiativeTrackerOpen) return null;

  // Sync to server after actions
  const handlePrev = () => {
    prevTurn();
    setTimeout(() => sendVttInitiativeUpdate(useInitiativeStore.getState().entries), 0);
  };

  const handleNext = () => {
    nextTurn();
    setTimeout(() => sendVttInitiativeUpdate(useInitiativeStore.getState().entries), 0);
  };

  const handleClear = () => {
    clear();
    setTimeout(() => sendVttInitiativeUpdate([]), 0);
  };

  const handleRemove = (id) => {
    removeTurn(id);
    setTimeout(() => sendVttInitiativeUpdate(useInitiativeStore.getState().entries), 0);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addEmptyTurn(newName.trim(), newValue);
    setIsAdding(false);
    setNewName('');
    setNewValue('');
    setTimeout(() => sendVttInitiativeUpdate(useInitiativeStore.getState().entries), 0);
  };

  return (
    <DraggablePanel
      id="initiative-tracker"
      title="Ініціатива"
      isOpen={isInitiativeTrackerOpen}
      onClose={toggleInitiativeTracker}
      openTrigger={initiativeTrackerOpenTrigger}
      defaultPos={{ x: 200, y: 100 }}
      defaultSize={{ width: 320, height: 400 }}
      minSize={{ width: 280, height: 300 }}
      className="bg-black/60 backdrop-blur-xl border-brand-accent/30 flex flex-col"
    >
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm">
            Немає кидків. Киньте ініціативу з чарника.
          </div>
        ) : (
          entries.map((entry, idx) => (
            <div 
              key={entry.id} 
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                idx === 0 
                  ? 'bg-brand-accent/20 border-brand-accent/50 shadow-[0_0_15px_rgba(var(--brand-accent-rgb),0.3)]' 
                  : 'bg-black/40 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx === 0 ? 'bg-brand-accent text-white' : 'bg-white/10 text-gray-300'
                }`}>
                  {idx + 1}
                </div>
                <span className="font-medium text-gray-200 truncate">{entry.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-brand-accent drop-shadow-[0_0_8px_rgba(var(--brand-accent-rgb),0.5)]">
                  {entry.value}
                </span>
                <button 
                  onClick={() => handleRemove(entry.id)}
                  className="text-gray-500 hover:text-red-400 transition-colors p-1"
                  title="Видалити"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}

        {isAdding && (
          <form onSubmit={handleAddSubmit} className="bg-black/40 border border-brand-accent/30 rounded-lg p-3 space-y-3 mt-2">
            <input
              type="text"
              placeholder="Ім'я..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-brand-accent outline-none"
            />
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Значення"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="w-1/2 bg-black/50 border border-white/10 rounded px-2 py-1 text-sm text-white focus:border-brand-accent outline-none"
              />
              <button 
                type="submit" 
                className="w-1/2 bg-brand-accent hover:bg-brand-accent/80 text-white rounded text-sm transition-colors"
              >
                Додати
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="p-2 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-black/40">
        <button
          onClick={handleClear}
          className="flex flex-col items-center justify-center p-2 rounded bg-black/40 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 transition-all text-xs gap-1"
          title="Очистити трекер"
        >
          <Trash2 className="w-4 h-4" />
          <span>Очистити</span>
        </button>
        <button
          onClick={handlePrev}
          className="flex flex-col items-center justify-center p-2 rounded bg-black/40 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 hover:border-white/20 transition-all text-xs gap-1"
          title="Відмінити 'Наступний'"
        >
          <Undo2 className="w-4 h-4" />
          <span>Відмінити</span>
        </button>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`flex flex-col items-center justify-center p-2 rounded transition-all text-xs gap-1 border ${
            isAdding 
              ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/50' 
              : 'bg-black/40 hover:bg-white/10 text-gray-400 hover:text-white border-white/5 hover:border-white/20'
          }`}
          title="Додати новий хід"
        >
          <Plus className="w-4 h-4" />
          <span>Додати</span>
        </button>
        <button
          onClick={handleNext}
          className="flex flex-col items-center justify-center p-2 rounded bg-brand-accent/10 hover:bg-brand-accent/30 text-brand-accent border border-brand-accent/30 hover:border-brand-accent transition-all text-xs gap-1"
          title="Наступний хід"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Наступний</span>
        </button>
      </div>
    </DraggablePanel>
  );
}
