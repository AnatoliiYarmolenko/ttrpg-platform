import React, { useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import useBattlefieldStore from './battlefield/useBattlefieldStore';
import useVttStore from '@/stores/useVttStore';
import {
  Layers, Plus, GripVertical, AlertCircle, Eye, EyeOff, Lock, Unlock, Upload, Edit2, Map, Trash2
} from 'lucide-react';
import DraggablePanel from './common/DraggablePanel';
import CreateSceneModal from './CreateSceneModal';
import ScenesBrowserModal from './ScenesBrowserModal';
import { uploadVttMap } from '../../sessions/api/sessionApi';
import InputModal from '@/components/shared/InputModal';

const MIN_WIDTH = 300;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 450;

/**
 * useMapUpload — хук для завантаження зображення-оверлея на активну сцену.
 *
 * Зображення додається поверх фону сцени, але під сіткою.
 * НЕ змінює розміри сцени і НЕ створює нову.
 *
 * @param {string | undefined} sessionId
 * @param {object | undefined} vttConnection
 * @returns {{
 *   isUploading: boolean,
 *   handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
 * }}
 */
function useMapUpload(sessionId, vttConnection) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    // Скидаємо значення input одразу, щоб можна було повторно вибрати той самий файл
    e.target.value = '';

    if (!file) return;

    if (!sessionId) {
      alert('Помилка: не знайдено ID сесії');
      return;
    }

    // Визначаємо активну сцену для додавання зображення (з захистом від застарілого gmViewSceneId)
    const storeState = useBattlefieldStore.getState();
    const gmView = storeState.gmViewSceneId;
    const activeSceneId = (gmView && storeState.scenes?.[gmView]) ? gmView : storeState.activeSceneId;

    if (!activeSceneId) {
      alert('Спочатку створіть або оберіть сцену');
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadVttMap(sessionId, file);
      const relativeUrl = result.data.url;

      // Додаємо зображення як оверлей на активну сцену
      vttConnection?.sendVttSceneAddImage?.(activeSceneId, relativeUrl, result.data.width, result.data.height);
    } catch (error) {
      alert('Не вдалося завантажити карту: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, vttConnection]);

  return { isUploading, handleFileChange };
}

/**
 * SceneManager — панель управління сценами та шарами.
 *
 * Функціонал:
 * - Перегляд та перемикання між сценами
 * - Керування видимістю та блокуванням шарів
 * - Завантаження карти у поточну сцену
 * - Транспортування гравців на іншу сцену
 *
 * @param {{ vttConnection?: object }} props
 */
export default function SceneManager({ vttConnection }) {
  const { isSceneManagerOpen, toggleSceneManager } = useVttStore();
  const { id: sessionId } = useParams();

  // Окремі селектори — уникаємо зайвих ре-рендерів при зміні viewport
  const scenes = useBattlefieldStore((s) => s.scenes);
  const activeSceneId = useBattlefieldStore((s) => s.activeSceneId);
  const gmViewSceneId = useBattlefieldStore((s) => s.gmViewSceneId);
  const setGmViewSceneId = useBattlefieldStore((s) => s.setGmViewSceneId);

  const [isCreateSceneModalOpen, setIsCreateSceneModalOpen] = useState(false);
  const [editingScene, setEditingScene] = useState(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isLayerPromptOpen, setIsLayerPromptOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const fileInputRef = useRef(null);

  const { isUploading, handleFileChange } = useMapUpload(sessionId, vttConnection);


  // GM-сцена яку він зараз переглядає (з захистом від застарілого ID)
  const viewedSceneId = gmViewSceneId && scenes?.[gmViewSceneId] ? gmViewSceneId : activeSceneId;
  const currentScene = viewedSceneId ? scenes[viewedSceneId] : null;

  // Чи сцена GM відрізняється від сцени гравців
  const isOutOfSync = Boolean(activeSceneId && viewedSceneId && activeSceneId !== viewedSceneId);

  const handleCreateScene = useCallback((data) => {
    vttConnection?.sendVttSceneCreate?.({
      name: data.name,
      width: data.width,
      height: data.height,
      backgroundUrl: null,
      backgroundColor: data.backgroundColor,
      gridEnabled: data.gridEnabled,
      gridType: data.gridType,
      gridColor: data.gridColor,
      gridSize: data.gridSize,
      gridOpacity: data.gridOpacity,
      gridScale: data.gridScale
    });
  }, [vttConnection]);

  const handleUpdateScene = useCallback((sceneId, data) => {
    vttConnection?.sendVttSceneUpdate?.(sceneId, data);
  }, [vttConnection]);

  const handleCreateLayer = useCallback(() => {
    setIsLayerPromptOpen(true);
  }, []);

  const confirmCreateLayer = useCallback((name) => {
    setIsLayerPromptOpen(false);
    if (name?.trim() && currentScene?.id) {
      vttConnection?.sendVttLayerCreate?.(currentScene.id, name.trim(), 'GENERIC');
    }
  }, [currentScene, vttConnection]);

  const confirmRename = useCallback((newName) => {
    if (newName?.trim() && currentScene?.id && renameTarget) {
      if (renameTarget.type === 'scene') {
        vttConnection?.sendVttSceneUpdate?.(renameTarget.id, { name: newName.trim() });
      } else if (renameTarget.type === 'layer') {
        vttConnection?.sendVttLayerUpdate?.(currentScene.id, renameTarget.id, { name: newName.trim() });
      }
    }
    setRenameTarget(null);
  }, [currentScene, renameTarget, vttConnection]);

  const handleToggleLayerVisible = useCallback((layer) => {
    if (!currentScene) return;
    vttConnection?.sendVttLayerUpdate?.(currentScene.id, layer.id, { isVisible: !layer.isVisible });
  }, [currentScene, vttConnection]);

  const handleToggleLayerLock = useCallback((layer) => {
    if (!currentScene) return;
    vttConnection?.sendVttLayerUpdate?.(currentScene.id, layer.id, { isLocked: !layer.isLocked });
  }, [currentScene, vttConnection]);

  const handleDeleteLayer = useCallback((layer) => {
    if (!currentScene) return;
    if (layer.type === 'BACKGROUND' || layer.type === 'GRID' || layer.type === 'TOKEN') return;
    vttConnection?.sendVttLayerDelete?.(currentScene.id, layer.id);
  }, [currentScene, vttConnection]);

  const handleTransportPlayers = useCallback(() => {
    if (viewedSceneId) {
      vttConnection?.sendVttSceneActivate?.(viewedSceneId);
    }
  }, [viewedSceneId, vttConnection]);

  // Drag and Drop State
  const [draggedLayerId, setDraggedLayerId] = useState(null);
  const [dragOverLayerId, setDragOverLayerId] = useState(null);

  const handleDragStart = (e, layer) => {
    setDraggedLayerId(layer.id);
    // Для Firefox
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', layer.id);
  };

  const handleDragOver = (e, layer) => {
    e.preventDefault(); // Дозволяємо drop
    if (layer.id !== draggedLayerId) {
      setDragOverLayerId(layer.id);
    }
  };

  const handleDragLeave = () => {
    setDragOverLayerId(null);
  };

  const handleDrop = (e, targetLayer) => {
    e.preventDefault();
    setDragOverLayerId(null);
    
    if (!draggedLayerId || draggedLayerId === targetLayer.id) return;
    
    const layers = [...(currentScene?.layers || [])];
    const fromIndex = layers.findIndex(l => l.id === draggedLayerId);
    const toIndex = layers.findIndex(l => l.id === targetLayer.id);
    
    if (fromIndex !== -1 && toIndex !== -1) {
      // Змінюємо порядок масиву
      const [movedLayer] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, movedLayer);
      
      const newLayerIds = layers.map(l => l.id);
      vttConnection?.sendVttLayerReorder?.(currentScene.id, newLayerIds);
    }
    
    setDraggedLayerId(null);
  };

  return (
    <>
      <DraggablePanel
        isOpen={isSceneManagerOpen}
        onClose={toggleSceneManager}
        title="Менеджер сцен"
        icon={<Layers size={16} className="text-brand-light" />}
        storageKey="vtt_sceneManagerState"
        defaultWidth={DEFAULT_WIDTH}
        defaultHeight={DEFAULT_HEIGHT}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        contentClassName="flex-1 flex flex-col overflow-y-auto min-h-0 bg-transparent text-white text-sm"
      >
          {/* Scene Selector */}
          <div className="p-3 border-b border-brand-light/10 bg-brand-medium/10">
            <div className="flex flex-col gap-2 mb-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 max-w-[70%]">
                  <select
                    value={viewedSceneId || ''}
                    onChange={(e) => setGmViewSceneId(e.target.value)}
                    className="bg-transparent text-xl font-bold text-white focus:outline-none appearance-none cursor-pointer max-w-full truncate"
                  >
                    {Object.values(scenes).map((scene) => (
                      <option key={scene.id} value={scene.id} className="bg-brand-dark text-base">
                        {typeof scene.name === 'string' ? scene.name : 'Untitled Scene'}
                      </option>
                    ))}
                    {Object.keys(scenes).length === 0 && (
                      <option value="" disabled>Немає сцен</option>
                    )}
                  </select>
                  {currentScene && (
                    <button
                      onClick={() => setRenameTarget({ type: 'scene', id: currentScene.id, name: currentScene.name })}
                      className="p-1 text-brand-light/40 hover:text-white transition-colors flex-shrink-0"
                      title="Перейменувати сцену"
                    >
                      <Edit2 size={14} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsBrowserOpen(true)}
                  className="text-xs font-bold uppercase tracking-wider text-brand-light/60 hover:text-white transition-colors"
                >
                  Браузер сцен
                </button>
              </div>

              {/* Upload Map Button */}
              {currentScene && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg, image/png, image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="p-1.5 bg-brand-primary hover:bg-brand-secondary rounded transition-colors text-white flex items-center justify-center gap-1 text-xs font-medium disabled:opacity-50"
                    title="Завантажити фон карти"
                  >
                    <Upload size={14} /> {isUploading ? '...' : 'Завантажити'}
                  </button>
                </div>
              )}
            </div>

            {currentScene && (
              <div className="text-brand-light/70 text-xs">
                {currentScene.width}×{currentScene.height} px
              </div>
            )}

            {isOutOfSync && (
              <div className="mt-3 p-2 bg-red-900/30 border-l-2 border-red-500 rounded-r text-xs">
                <div className="flex gap-2 items-start text-red-200">
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
                  <div>
                    <span className="font-bold text-white">Ваші гравці знаходяться на іншій сцені.</span>
                    <button
                      onClick={handleTransportPlayers}
                      className="block text-red-400 hover:text-red-300 underline mt-1"
                    >
                      Перемістити їх сюди зараз.
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid Info */}
          <div className="p-3 border-b border-brand-light/10 text-xs text-brand-light/80 bg-brand-medium/5">
            <div className="font-bold text-white">
              {currentScene?.gridEnabled ? 'Сітка увімкнена' : 'Сітка вимкнена'}
            </div>
            {currentScene?.gridEnabled && (
              <div>1 клітинка = {currentScene?.gridScale ?? 5} футів</div>
            )}
          </div>

          {/* Layers List */}
          <ul className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
            {/* Рендеримо з кінця (reverse), щоб верхні шари (великий z-index) були згори списку */}
            {[...(currentScene?.layers || [])].reverse().map((layer) => {
              let dragClass = 'border-brand-light/5';
              if (draggedLayerId === layer.id) {
                dragClass = 'opacity-50 border-dashed border-brand-light/50';
              } else if (dragOverLayerId === layer.id) {
                dragClass = 'border-brand-accent scale-[1.02] shadow-md shadow-brand-accent/20 bg-brand-medium/50';
              }

              return (
                <li
                  key={layer.id}
                  draggable={!layer.isLocked}
                  onDragStart={(e) => !layer.isLocked && handleDragStart(e, layer)}
                  onDragOver={(e) => handleDragOver(e, layer)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, layer)}
                  className={`flex items-center gap-2 p-2 bg-brand-dark/50 hover:bg-brand-medium/30 border rounded transition-all duration-200 group ${
                    layer.isLocked ? '' : 'cursor-grab active:cursor-grabbing'
                  } ${dragClass}`}
                >
                <button
                  onClick={() => handleToggleLayerVisible(layer)}
                  className={`transition-colors ${layer.isVisible ? 'text-brand-light hover:text-white' : 'text-brand-light/30 hover:text-brand-light'}`}
                  title={layer.isVisible ? 'Приховати шар' : 'Показати шар'}
                >
                  {layer.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                <div className="flex-1 overflow-hidden flex items-center gap-2">
                  {layer.type === 'BACKGROUND' && <Map size={14} className="text-brand-light/50 shrink-0" />}
                  <span className="truncate">{typeof layer.name === 'string' ? layer.name : 'Шар'}</span>
                  <button
                    onClick={() => setRenameTarget({ type: 'layer', id: layer.id, name: layer.name })}
                    className="p-1 text-brand-light/0 group-hover:text-brand-light/40 hover:!text-white transition-colors"
                    title="Перейменувати шар"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>

                <button
                  onClick={() => handleToggleLayerLock(layer)}
                  className={`transition-all duration-300 ${layer.isLocked ? 'text-amber-400 hover:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-brand-light/50 hover:text-white'}`}
                  title={layer.isLocked ? 'Розблокувати шар' : 'Заблокувати шар'}
                >
                  {layer.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>

                {!(layer.type === 'BACKGROUND' || layer.type === 'GRID' || layer.type === 'TOKEN') && (
                  <button
                    onClick={() => handleDeleteLayer(layer)}
                    className="text-brand-light/30 hover:text-red-400 transition-colors"
                    title="Видалити шар"
                  >
                    <Trash2 size={14} />
                  </button>
                )}

                <div className={`px-1 ${layer.isLocked ? 'text-brand-light/10 cursor-not-allowed' : 'text-brand-light/30 hover:text-brand-light'}`}>
                  <GripVertical size={14} />
                  </div>
                </li>
              );
            })}

            {(!currentScene?.layers?.length) && (
              <li className="text-center text-brand-light/50 p-4 italic text-xs">
                {currentScene ? 'Немає шарів у цій сцені' : 'Оберіть або створіть сцену'}
              </li>
            )}
          </ul>

          {/* Bottom Toolbar */}
          <div className="flex border-t border-brand-light/10 bg-brand-medium/20 p-1 shrink-0">
            <button
              onClick={() => setIsCreateSceneModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-white hover:bg-brand-light/10 rounded transition-colors"
            >
              <Plus size={14} /> Нова сцена
            </button>
            <div className="w-px bg-brand-light/10 my-1" />
            <button
              onClick={handleCreateLayer}
              disabled={!currentScene}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-white hover:bg-brand-light/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Layers size={14} /> Новий шар
            </button>
          </div>
      </DraggablePanel>

      <CreateSceneModal
        isOpen={isCreateSceneModalOpen || !!editingScene}
        onClose={() => {
          setIsCreateSceneModalOpen(false);
          setEditingScene(null);
        }}
        onCreate={handleCreateScene}
        onUpdate={handleUpdateScene}
        initialData={editingScene}
      />
      <ScenesBrowserModal
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        vttConnection={vttConnection}
        onEditScene={(scene) => setEditingScene(scene)}
      />

      <InputModal
        isOpen={isLayerPromptOpen}
        title="Новий шар"
        message="Введіть назву для нового шару:"
        placeholder="Наприклад: Пастки, Ефекти..."
        defaultValue="Новий шар"
        theme="dark"
        confirmText="Створити"
        cancelText="Скасувати"
        onConfirm={confirmCreateLayer}
        onCancel={() => setIsLayerPromptOpen(false)}
      />

      <InputModal
        isOpen={!!renameTarget}
        title={`Перейменувати ${renameTarget?.type === 'scene' ? 'сцену' : 'шар'}`}
        message="Введіть нову назву:"
        placeholder="Нова назва..."
        defaultValue={renameTarget?.name || ''}
        theme="dark"
        confirmText="Зберегти"
        cancelText="Скасувати"
        onConfirm={confirmRename}
        onCancel={() => setRenameTarget(null)}
      />
    </>
  );
}

SceneManager.propTypes = {
  vttConnection: PropTypes.object,
};
