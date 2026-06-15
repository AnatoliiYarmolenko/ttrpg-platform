import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Users, Plus, X, Skull, User as UserIcon } from 'lucide-react';
import useVttStore from '@/stores/useVttStore';
import useGmCreaturesStore from '@/stores/useGmCreaturesStore';
import useBattlefieldStore from './battlefield/useBattlefieldStore';
import DraggablePanel from './common/DraggablePanel';
import CreatureSheetContent from './CreatureSheetContent';
import Button from '@/components/ui/Button';

export default function VttGmCreatures({ vttConnection }) {
  const { isGmCreaturesOpen, toggleGmCreaturesOpen, gmCreaturesOpenTrigger, rollStrength } = useVttStore();
  const { 
    creatures, activeTabId, setActiveTab, addCreature, removeCreature, 
    updateCreatureData, updateCreatureStat, updateCreatureCoin, 
    toggleCreatureSavingThrow, toggleCreatureSkill 
  } = useGmCreaturesStore();

  const storeActiveSceneId = useBattlefieldStore((s) => s.activeSceneId);
  const storeGmViewSceneId = useBattlefieldStore((s) => s.gmViewSceneId);
  const activeSceneId = storeGmViewSceneId || storeActiveSceneId;
  const activeScene = useBattlefieldStore((s) => s.scenes?.[activeSceneId]);

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState(null);

  if (!isGmCreaturesOpen) return null;

  const activeCreature = creatures.find(c => c.id === activeTabId);

  const handleDragStart = (e, index) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== index) {
      useGmCreaturesStore.getState().reorderCreatures(draggedIdx, index);
    }
    setDraggedIdx(null);
  };

  const handleAddClick = () => {
    setShowTypeModal(true);
  };

  const handleSelectType = (type) => {
    addCreature(type);
    setShowTypeModal(false);
  };

  const createCallbacks = (id) => ({
    updateField: (field, value) => {
      updateCreatureData(id, field, value);
      
      if (['name', 'avatarUrl', 'hpCurrent', 'hpMax', 'tempHp', 'tokenBorderColor'].includes(field)) {
        const sceneId = useBattlefieldStore.getState().gmViewSceneId || useBattlefieldStore.getState().activeSceneId;
        const myTokenId = `token-gm-${id}`;
        const scene = useBattlefieldStore.getState().scenes?.[sceneId];
        
        if (sceneId && scene?.tokens?.[myTokenId]) {
          const updatePayload = {};
          if (field === 'tokenBorderColor') updatePayload.color = value;
          else updatePayload[field] = value;
          
          vttConnection?.sendVttTokenUpdate?.(sceneId, myTokenId, updatePayload);
        }
      }
    },
    updateStat: (stat, value) => updateCreatureStat(id, stat, value),
    updateCoin: (coin, value) => updateCreatureCoin(id, coin, value),
    toggleSavingThrow: (stat) => toggleCreatureSavingThrow(id, stat),
    toggleSkill: (skill) => toggleCreatureSkill(id, skill),
    addAttack: () => useGmCreaturesStore.getState().addCreatureAttack(id),
    updateAttack: (attackId, field, value) => useGmCreaturesStore.getState().updateCreatureAttack(id, attackId, field, value),
    removeAttack: (attackId) => useGmCreaturesStore.getState().removeCreatureAttack(id, attackId),
    handleRemoveToken: () => {
      const sceneId = useBattlefieldStore.getState().gmViewSceneId || useBattlefieldStore.getState().activeSceneId;
      if (!sceneId) return;
      vttConnection?.sendVttTokenRemove?.(sceneId, `token-gm-${id}`);
      
      useBattlefieldStore.setState((state) => {
        const scenes = { ...state.scenes };
        if (scenes[sceneId]?.tokens) {
          scenes[sceneId].tokens = { ...scenes[sceneId].tokens };
          delete scenes[sceneId].tokens[`token-gm-${id}`];
        }
        return { scenes };
      });
    },
    handleAddToken: () => {
      const sceneId = useBattlefieldStore.getState().gmViewSceneId || useBattlefieldStore.getState().activeSceneId;
      if (!sceneId) return;

      const creature = creatures.find(c => c.id === id);
      if (!creature) return;

      const tokenData = {
        id: `token-gm-${id}`,
        name: creature.data.name || 'Істота',
        avatarUrl: creature.data.avatarUrl || null,
        hpCurrent: creature.data.hpCurrent,
        hpMax: creature.data.hpMax,
        tempHp: creature.data.tempHp || 0,
        isAlly: creature.type !== 'monster',
        size: 1, // Default 1x1
        isGmCreature: true,
        creatureId: creature.id,
        color: creature.data.tokenBorderColor,
        x: 0,
        y: 0,
      };
      
      vttConnection?.sendVttTokenAdd?.(sceneId, tokenData);

      useBattlefieldStore.setState((state) => {
        const scenes = { ...state.scenes };
        if (scenes[sceneId]) {
          scenes[sceneId].tokens = { ...scenes[sceneId].tokens, [`token-gm-${id}`]: tokenData };
        }
        return { scenes };
      });
    }
  });

  const myTokenId = activeCreature ? `token-gm-${activeCreature.id}` : null;
  const isTokenOnTable = activeScene?.tokens?.[myTokenId] !== undefined;

  return (
    <DraggablePanel
      isOpen={isGmCreaturesOpen}
      onClose={toggleGmCreaturesOpen}
      openTrigger={gmCreaturesOpenTrigger}
      title="Мої істоти"
      icon={<Users size={18} />}
      storageKey="vtt-gm-creatures-pos"
      defaultWidth={650}
      defaultHeight={600}
      minWidth={550}
      minHeight={500}
      initialState={{ x: 100, y: 100 }}
      contentClassName="flex flex-col flex-1 bg-transparent text-sm overflow-hidden relative"
    >
      {/* Вкладки (Tabs) */}
      <div className="flex items-center bg-black/40 border-b border-brand-light/10 overflow-x-auto custom-scrollbar shrink-0">
        {creatures.map((creature, index) => (
          <button 
            type="button"
            key={creature.id}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e)}
            onDrop={(e) => handleDrop(e, index)}
            onClick={() => setActiveTab(creature.id)}
            className={`flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-brand-light/10 transition-colors whitespace-nowrap select-none outline-none ${activeTabId === creature.id ? 'bg-brand-medium/30 border-b-2 border-b-brand-accent text-white' : 'hover:bg-brand-medium/10 text-brand-light/70'} ${draggedIdx === index ? 'opacity-50' : ''}`}
          >
            {creature.type === 'monster' ? <Skull size={14} className="text-red-400" /> : <UserIcon size={14} className="text-blue-400" />}
            <span className="font-medium text-xs truncate max-w-[120px]">
              {creature.data.name || (creature.type === 'monster' ? 'Новий Ворог' : 'Новий NPC')}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                removeCreature(creature.id);
              }}
              className="p-0.5 rounded-full hover:bg-white/10 text-brand-light/50 hover:text-red-400 transition-colors ml-1"
            >
              <X size={12} />
            </button>
          </button>
        ))}
        
        <button 
          onClick={handleAddClick}
          className="flex items-center justify-center p-2 text-brand-light/70 hover:text-white hover:bg-brand-medium/20 transition-colors min-w-[40px]"
          title="Додати істоту"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Вміст активної вкладки */}
      <div className="h-full flex flex-col min-h-0 relative">
        {activeCreature ? (
          <CreatureSheetContent
            data={activeCreature.data}
            type={activeCreature.type}
            showNotesBtn={false}
            isGM={true}
            vttConnection={vttConnection}
            rollStrength={rollStrength}
            callbacks={createCallbacks(activeCreature.id)}
            isTokenOnTable={isTokenOnTable}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-brand-light/40">
            <Users size={48} className="mb-4 opacity-20" />
            <p>Немає відкритих істот.</p>
            <Button variant="outline" className="mt-4 border-brand-light/20 text-brand-light hover:text-white" onClick={handleAddClick}>
              <Plus size={16} className="mr-2" /> Додати
            </Button>
          </div>
        )}

        {/* Модальне вікно вибору типу */}
        {showTypeModal && (
          <div className="absolute inset-0 bg-brand-dark/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-brand-medium border border-brand-light/10 rounded-xl p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-2 text-center">Нова істота</h3>
              <p className="text-sm text-brand-light/70 mb-6 text-center">Оберіть тип істоти, яку ви хочете створити.</p>
              
              <div className="flex gap-4 mb-6">
                <button 
                  type="button"
                  className="flex-1 bg-black/30 border border-brand-light/10 rounded-lg p-4 flex flex-col items-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-900/20 transition-all group outline-none focus:border-blue-400"
                  onClick={() => handleSelectType('human')}
                >
                  <UserIcon size={32} className="text-blue-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-white">NPC</span>
                </button>
                
                <button 
                  type="button"
                  className="flex-1 bg-black/30 border border-brand-light/10 rounded-lg p-4 flex flex-col items-center gap-3 cursor-pointer hover:border-red-400 hover:bg-red-900/20 transition-all group outline-none focus:border-red-400"
                  onClick={() => handleSelectType('monster')}
                >
                  <Skull size={32} className="text-red-400 group-hover:scale-110 transition-transform" />
                  <span className="font-bold text-white">Ворог</span>
                </button>
              </div>

              <Button 
                variant="ghost" 
                className="w-full text-brand-light hover:text-white"
                onClick={() => setShowTypeModal(false)}
              >
                Скасувати
              </Button>
            </div>
          </div>
        )}
      </div>
    </DraggablePanel>
  );
}

VttGmCreatures.propTypes = {
  vttConnection: PropTypes.object
};
