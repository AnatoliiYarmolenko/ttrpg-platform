import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Layers, Search, Trash2, Eye, Users, X, Settings, Edit2 } from 'lucide-react';
import DraggablePanel from './common/DraggablePanel';
import useBattlefieldStore from './battlefield/useBattlefieldStore';
import ConfirmModal from '@/components/shared/ConfirmModal';
import InputModal from '@/components/shared/InputModal';

const EMPTY_OBJECT = {};

export default function ScenesBrowserModal({ isOpen, onClose, vttConnection, onEditScene }) {
  const scenes = useBattlefieldStore(s => s.scenes) || EMPTY_OBJECT;
  const activeSceneId = useBattlefieldStore(s => s.activeSceneId);
  const gmViewSceneId = useBattlefieldStore(s => s.gmViewSceneId);
  const setGmViewSceneId = useBattlefieldStore(s => s.setGmViewSceneId);

  const [searchTerm, setSearchTerm] = useState('');
  const [sceneToDelete, setSceneToDelete] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);

  const filteredScenes = useMemo(() => {
    return Object.values(scenes).filter(scene => 
      scene.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [scenes, searchTerm]);

  const handleActivate = (id) => {
    vttConnection?.sendVttSceneActivate?.(id);
  };

  const confirmRename = (newName) => {
    if (newName?.trim() && renameTarget) {
      vttConnection?.sendVttSceneUpdate?.(renameTarget.id, { name: newName.trim() });
    }
    setRenameTarget(null);
  };

  const confirmDelete = () => {
    if (sceneToDelete) {
      vttConnection?.sendVttSceneDelete?.(sceneToDelete.id);
      if (gmViewSceneId === sceneToDelete.id) {
        setGmViewSceneId(null);
      }
    }
    setSceneToDelete(null);
  };

  const handleView = (id) => {
    setGmViewSceneId(id);
  };

  return (
    <DraggablePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Браузер сцен"
      icon={<Layers size={16} className="text-brand-light" />}
      storageKey="vtt_scenesBrowserState"
      defaultWidth={450}
      defaultHeight={550}
      defaultX={globalThis.window?.innerWidth ? globalThis.window.innerWidth / 2 - 225 : 0}
      defaultY={globalThis.window?.innerHeight ? globalThis.window.innerHeight / 2 - 275 : 0}
      minWidth={350}
      minHeight={400}
      headerClassName="bg-brand-dark/30"
      contentClassName="flex-1 flex flex-col min-h-0 bg-transparent text-white"
    >
      <div className="p-4 border-b border-brand-light/10 bg-brand-dark/30 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-light/50" />
          <input
            type="text"
            placeholder="Пошук сцен..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-brand-light/20 rounded-lg py-2 pl-9 pr-8 text-sm text-white placeholder:text-brand-light/30 focus:outline-none focus:border-brand-accent transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-light/50 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {filteredScenes.length === 0 ? (
          <div className="text-center text-brand-light/50 text-sm mt-10">
            {Object.keys(scenes).length === 0 ? "Сцен ще немає." : "Сцен не знайдено."}
          </div>
        ) : (
          filteredScenes.map(scene => {
            const isActive = scene.id === activeSceneId;
            const isViewed = scene.id === (gmViewSceneId && scenes?.[gmViewSceneId] ? gmViewSceneId : activeSceneId);

            let cardClass = 'border-brand-light/10 bg-brand-dark/50 hover:bg-brand-medium/20 hover:border-brand-light/30';
            if (isActive) {
              cardClass = 'border-brand-accent/50 bg-brand-accent/10 shadow-[0_0_15px_rgba(251,191,36,0.15)]';
            } else if (isViewed) {
              cardClass = 'border-brand-light/30 bg-brand-medium/30';
            }

            return (
              <div 
                key={scene.id}
                className={`group flex flex-col gap-2 p-3 rounded-lg border transition-all ${cardClass}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
                      <div className="flex items-center gap-2 max-w-full">
                        <span className="font-bold text-sm text-brand-light truncate">{scene.name || 'Без назви'}</span>
                        <button
                          onClick={() => setRenameTarget(scene)}
                          className="p-1 text-brand-light/0 group-hover:text-brand-light/40 hover:!text-white transition-colors"
                          title="Перейменувати сцену"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2">
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark bg-brand-accent px-1.5 py-0.5 rounded shadow-sm">
                          Активно для гравців
                        </span>
                      )}
                      {isViewed && !isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-light bg-brand-light/20 px-1.5 py-0.5 rounded">
                          Зараз переглядається
                        </span>
                      )}
                      <span className="text-xs text-brand-light/50">
                        {scene.width}x{scene.height}
                      </span>
                    </div>
                  </div>
                </div>

                  <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-brand-dark/80 backdrop-blur rounded-md p-1 border border-brand-light/10">
                    <button
                      onClick={() => handleView(scene.id)}
                      className={`p-1.5 rounded-md transition-colors ${isViewed ? 'text-brand-accent bg-brand-accent/10' : 'text-brand-light hover:text-white hover:bg-brand-light/10'}`}
                      title="Переглянути (тільки для GM)"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleActivate(scene.id)}
                      className={`p-1.5 rounded-md transition-colors ${isActive ? 'text-green-400 bg-green-400/10' : 'text-brand-light hover:text-green-400 hover:bg-green-400/10'}`}
                      title="Активувати для всіх гравців"
                    >
                      <Users size={16} />
                    </button>
                    <button
                      onClick={() => onEditScene?.(scene)}
                      className="p-1.5 rounded-md text-brand-light hover:text-brand-accent hover:bg-brand-accent/10 transition-colors"
                      title="Налаштування сцени"
                    >
                      <Settings size={16} />
                    </button>
                    <button
                      onClick={() => setSceneToDelete(scene)}
                      className="p-1.5 rounded-md text-brand-light hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      title="Видалити сцену"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={!!sceneToDelete}
        title="Видалити сцену?"
        message={`Ви впевнені, що хочете видалити сцену "${sceneToDelete?.name || 'Без назви'}"? Це незворотна дія.`}
        confirmText="Видалити"
        cancelText="Скасувати"
        variant="danger"
        theme="dark"
        onConfirm={confirmDelete}
        onCancel={() => setSceneToDelete(null)}
      />

      <InputModal
        isOpen={!!renameTarget}
        title="Перейменувати сцену"
        message="Введіть нову назву:"
        placeholder="Нова назва..."
        defaultValue={renameTarget?.name || ''}
        theme="dark"
        confirmText="Зберегти"
        cancelText="Скасувати"
        onConfirm={confirmRename}
        onCancel={() => setRenameTarget(null)}
      />
    </DraggablePanel>
  );
}

ScenesBrowserModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onEditScene: PropTypes.func,
  vttConnection: PropTypes.shape({
    sendVttSceneActivate: PropTypes.func,
    sendVttSceneUpdate: PropTypes.func,
    sendVttSceneDelete: PropTypes.func,
  }),
};
