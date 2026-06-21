import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { User, ArrowLeft } from 'lucide-react';
import useVttStore from '@/stores/useVttStore';
import useCharacterStore from '@/stores/useCharacterStore';
import useAuthStore from '@/stores/useAuthStore';
import DraggablePanel from './common/DraggablePanel';
import Button from '@/components/ui/Button';
import CreatureSheetContent from './CreatureSheetContent';
import useBattlefieldStore from './battlefield/useBattlefieldStore';

export default function VttCharacterSheet({ isGM, vttConnection }) {
  const { isCharacterSheetOpen, toggleCharacterSheet, characterSheetOpenTrigger, rollStrength, incomingRoll } = useVttStore();
  const [viewMode, setViewMode] = useState('main'); // 'main' | 'notes'
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'features' | 'backpack'
  const prevRollIdRef = useRef(null);

  const characterData = useCharacterStore();
  const {
    notes, features, backpack, hpCurrent, hpMax, name, updateField,
    updateStat, updateCoin, toggleSavingThrow, toggleSkill,
    addAttack, updateAttack, removeAttack
  } = characterData;

  const user = useAuthStore((s) => s.user);
  const myTokenId = `token-player-${user?.id || 'guest'}`;

  const storeScenes = useBattlefieldStore((s) => s.scenes);
  const storeActiveSceneId = useBattlefieldStore((s) => s.activeSceneId);
  const storeGmViewSceneId = useBattlefieldStore((s) => s.gmViewSceneId);
  const activeSceneId = isGM ? (storeGmViewSceneId && storeScenes?.[storeGmViewSceneId] ? storeGmViewSceneId : storeActiveSceneId) : storeActiveSceneId;
  
  const activeScene = useBattlefieldStore((s) => s.scenes?.[activeSceneId]);
  const isTokenOnTable = activeScene?.tokens?.[myTokenId] !== undefined;

  useEffect(() => {
    if (!incomingRoll) return;
    if (incomingRoll.id !== prevRollIdRef.current) {
      prevRollIdRef.current = incomingRoll.id;
      const charName = isGM ? undefined : name;
      const finalCharName = (charName && charName !== 'Без імені') ? charName : 'Гравець';
      
      if (incomingRoll.name === 'Кість хітів (Лікування)' && incomingRoll.player === finalCharName) {
        const healAmount = incomingRoll.total;
        updateField('hpCurrent', Math.min(hpMax, hpCurrent + healAmount));
      }
    }
  }, [incomingRoll, hpCurrent, hpMax, isGM, name, updateField]);

  if (!isCharacterSheetOpen) return null;

  const callbacks = {
    updateField: (field, value) => {
      useCharacterStore.getState().updateField(field, value);
      
      if (['name', 'avatarUrl', 'hpCurrent', 'hpMax', 'tempHp', 'tokenBorderColor'].includes(field)) {
        if (activeSceneId && isTokenOnTable) {
          const updatePayload = {};
          if (field === 'tokenBorderColor') updatePayload.color = value;
          else updatePayload[field] = value;
          
          vttConnection?.sendVttTokenUpdate?.(activeSceneId, myTokenId, updatePayload);
        }
      }
    },
    updateStat,
    updateCoin,
    toggleSavingThrow,
    toggleSkill,
    addAttack,
    updateAttack,
    removeAttack,
    handleRemoveToken: () => {
      if (!activeSceneId) return;
      vttConnection?.sendVttTokenRemove?.(activeSceneId, myTokenId);
      
      // Optimistic UI update
      useBattlefieldStore.setState((state) => {
        const scenes = { ...state.scenes };
        if (scenes[activeSceneId]?.tokens) {
          scenes[activeSceneId].tokens = { ...scenes[activeSceneId].tokens };
          delete scenes[activeSceneId].tokens[myTokenId];
        }
        return { scenes };
      });
    },
    handleAddToken: () => {
      if (!activeSceneId) return;

      const tokenData = {
        id: myTokenId,
        ownerId: user?.id,
        isGmCreature: false,
        name: characterData.name || 'Гравець',
        avatarUrl: characterData.avatarUrl || null,
        hpCurrent: characterData.hpCurrent,
        hpMax: characterData.hpMax,
        tempHp: characterData.tempHp || 0,
        isAlly: true,
        size: 1, // Default 1x1
        color: characterData.tokenBorderColor,
        x: 0,
        y: 0,
      };
      
      vttConnection?.sendVttTokenAdd?.(activeSceneId, tokenData);
      
      // Optimistic UI update
      useBattlefieldStore.setState((state) => {
        const scenes = { ...state.scenes };
        if (scenes[activeSceneId]) {
          scenes[activeSceneId].tokens = { ...scenes[activeSceneId].tokens, [myTokenId]: tokenData };
        }
        return { scenes };
      });
    }
  };

  const renderNotesView = () => (
    <div className="flex flex-col flex-1 h-full p-4 overflow-hidden">
      <div className="flex items-center gap-4 mb-4 border-b border-brand-light/10 pb-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setViewMode('main')} className="text-brand-light hover:text-white">
          <ArrowLeft size={18} />
          Назад
        </Button>
        <div className="flex gap-2">
          <Button 
            variant={activeTab === 'general' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setActiveTab('general')}
            className={activeTab === 'general' ? '' : '!border-brand-light/20 !text-brand-light'}
          >
            Загальні нотатки
          </Button>
          <Button 
            variant={activeTab === 'features' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setActiveTab('features')}
            className={activeTab === 'features' ? '' : '!border-brand-light/20 !text-brand-light'}
          >
            Особливості
          </Button>
          <Button 
            variant={activeTab === 'backpack' ? 'primary' : 'outline'} 
            size="sm" 
            onClick={() => setActiveTab('backpack')}
            className={activeTab === 'backpack' ? '' : '!border-brand-light/20 !text-brand-light'}
          >
            Інвентар
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {activeTab === 'general' && (
          <textarea
            value={notes}
            onChange={(e) => updateField('notes', e.target.value)}
            placeholder="Ваші нотатки..."
            className="flex-1 w-full bg-black/30 border border-brand-light/20 rounded p-3 text-white placeholder:text-brand-light/30 focus:border-brand-accent outline-none resize-none custom-scrollbar"
          />
        )}
        {activeTab === 'features' && (
          <textarea
            value={features}
            onChange={(e) => updateField('features', e.target.value)}
            placeholder="Особливості класу, раси, здібності..."
            className="flex-1 w-full bg-black/30 border border-brand-light/20 rounded p-3 text-white placeholder:text-brand-light/30 focus:border-brand-accent outline-none resize-none custom-scrollbar"
          />
        )}
        {activeTab === 'backpack' && (
          <textarea
            value={backpack}
            onChange={(e) => updateField('backpack', e.target.value)}
            placeholder="Інвентар, спорядження, гроші..."
            className="flex-1 w-full bg-black/30 border border-brand-light/20 rounded p-3 text-white placeholder:text-brand-light/30 focus:border-brand-accent outline-none resize-none custom-scrollbar"
          />
        )}
      </div>
    </div>
  );

  return (
    <DraggablePanel
      isOpen={isCharacterSheetOpen}
      onClose={toggleCharacterSheet}
      openTrigger={characterSheetOpenTrigger}
      title={isGM ? 'Мій персонаж (GM)' : 'Мій персонаж'}
      icon={<User size={18} />}
      storageKey="vtt-character-sheet-pos"
      defaultWidth={650}
      defaultHeight={600}
      minWidth={550}
      minHeight={500}
      initialState={{ x: 50, y: 50 }}
      contentClassName="flex flex-col flex-1 bg-transparent text-sm overflow-hidden"
    >
      <div className="h-full flex flex-col">
        {viewMode === 'main' ? (
          <CreatureSheetContent
            id="player"
            data={characterData}
            type="player"
            showNotesBtn={true}
            isGM={isGM}
            vttConnection={vttConnection}
            rollStrength={rollStrength}
            onToggleNotes={() => setViewMode('notes')}
            callbacks={callbacks}
            isTokenOnTable={isTokenOnTable}
          />
        ) : renderNotesView()}
      </div>
    </DraggablePanel>
  );
}

VttCharacterSheet.propTypes = {
  isGM: PropTypes.bool,
  vttConnection: PropTypes.object
};
