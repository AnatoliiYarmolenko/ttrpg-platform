import React, { useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import useBattlefieldStore from './battlefield/useBattlefieldStore';
import useVttStore from '@/stores/useVttStore';
import {
  GripVertical, Lock, Unlock, Eye, EyeOff,
  Map, Layers, Plus, AlertCircle, Upload
} from 'lucide-react';
import DraggablePanel from './common/DraggablePanel';
import CreateSceneModal from './CreateSceneModal';
import ScenesBrowserModal from './ScenesBrowserModal';
import { uploadVttMap } from '../../sessions/api/sessionApi';

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
 * @param {object | undefined} chatController
 * @returns {{
 *   isUploading: boolean,
 *   handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>
 * }}
 */
function useMapUpload(sessionId, chatController) {
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

    // Визначаємо активну сцену для додавання зображення
    const activeSceneId = useBattlefieldStore.getState().gmViewSceneId
      || useBattlefieldStore.getState().activeSceneId;

    if (!activeSceneId) {
      alert('Спочатку створіть або оберіть сцену');
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadVttMap(sessionId, file);
      const relativeUrl = result.data.url;

      // Додаємо зображення як оверлей на активну сцену
      chatController?.sendVttSceneAddImage?.(activeSceneId, relativeUrl, result.data.width, result.data.height);
    } catch (error) {
      alert('Не вдалося завантажити карту: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsUploading(false);
    }
  }, [sessionId, chatController]);

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
 * @param {{ chatController?: object }} props
 */
export default function SceneManager({ chatController }) {
  const { isSceneManagerOpen, toggleSceneManager, sceneManagerState, setSceneManagerState } = useVttStore();
  const { id: sessionId } = useParams();

  // Окремі селектори — уникаємо зайвих ре-рендерів при зміні viewport
  const scenes = useBattlefieldStore((s) => s.scenes);
  const activeSceneId = useBattlefieldStore((s) => s.activeSceneId);
  const gmViewSceneId = useBattlefieldStore((s) => s.gmViewSceneId);
  const setGmViewSceneId = useBattlefieldStore((s) => s.setGmViewSceneId);

  const [isCreateSceneModalOpen, setIsCreateSceneModalOpen] = useState(false);
  const [editingScene, setEditingScene] = useState(null);
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { isUploading, handleFileChange } = useMapUpload(sessionId, chatController);


  // GM-сцена яку він зараз переглядає
  const viewedSceneId = gmViewSceneId || activeSceneId;
  const currentScene = viewedSceneId ? scenes[viewedSceneId] : null;

  // Чи сцена GM відрізняється від сцени гравців
  const isOutOfSync = Boolean(activeSceneId && viewedSceneId && activeSceneId !== viewedSceneId);

  const handleCreateScene = useCallback((data) => {
    chatController?.sendVttSceneCreate?.({
      name: data.name,
      width: data.width,
      height: data.height,
      backgroundUrl: null,
      backgroundColor: data.backgroundColor,
      gridEnabled: data.gridEnabled,
      gridType: data.gridType,
      gridColor: data.gridColor,
      gridSize: data.gridSize,
      gridOpacity: data.gridOpacity
    });
  }, [chatController]);

  const handleUpdateScene = useCallback((sceneId, data) => {
    chatController?.sendVttSceneUpdate?.(sceneId, data);
  }, [chatController]);

  const handleCreateLayer = useCallback(() => {
    if (!currentScene) return;
    /* Модалка створення шару буде додана пізніше */
    const name = globalThis.window?.prompt('Назва нового шару:', 'New layer');
    if (name?.trim()) {
      chatController?.sendVttLayerCreate?.(currentScene.id, name.trim(), 'GENERIC');
    }
  }, [currentScene, chatController]);

  const handleToggleLayerVisible = useCallback((layer) => {
    if (!currentScene) return;
    chatController?.sendVttLayerUpdate?.(currentScene.id, layer.id, { isVisible: !layer.isVisible });
  }, [currentScene, chatController]);

  const handleToggleLayerLock = useCallback((layer) => {
    if (!currentScene) return;
    chatController?.sendVttLayerUpdate?.(currentScene.id, layer.id, { isLocked: !layer.isLocked });
  }, [currentScene, chatController]);

  const handleTransportPlayers = useCallback(() => {
    if (viewedSceneId) {
      chatController?.sendVttSceneActivate?.(viewedSceneId);
    }
  }, [viewedSceneId, chatController]);

  return (
    <>
      <DraggablePanel
        isOpen={isSceneManagerOpen}
        onClose={toggleSceneManager}
        title="Scene manager"
        icon={<Layers size={16} className="text-brand-light" />}
        initialState={sceneManagerState}
        onSaveState={setSceneManagerState}
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
                <select
                  value={viewedSceneId || ''}
                  onChange={(e) => setGmViewSceneId(e.target.value)}
                  className="bg-transparent text-xl font-bold text-white focus:outline-none appearance-none cursor-pointer"
                >
                  {Object.values(scenes).map((scene) => (
                    <option key={scene.id} value={scene.id} className="bg-brand-dark text-base">
                      {scene.name}
                    </option>
                  ))}
                  {Object.keys(scenes).length === 0 && (
                    <option value="" disabled>Немає сцен</option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setIsBrowserOpen(true)}
                  className="text-xs font-bold uppercase tracking-wider text-brand-light/60 hover:text-white transition-colors"
                >
                  Scenes browser
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
                    title="Upload map background"
                  >
                    <Upload size={14} /> {isUploading ? '...' : 'Upload'}
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
                    <span className="font-bold text-white">Your players are on a different scene.</span>
                    <button
                      onClick={handleTransportPlayers}
                      className="block text-red-400 hover:text-red-300 underline mt-1"
                    >
                      Transport them here now.
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid Info */}
          <div className="p-3 border-b border-brand-light/10 text-xs text-brand-light/80 bg-brand-medium/5">
            <div className="font-bold text-white">Grid enabled</div>
            <div>1 unit = 5 ft</div>
          </div>

          {/* Layers List */}
          <div className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
            {currentScene?.layers?.map((layer) => (
              <div
                key={layer.id}
                className="flex items-center gap-2 p-2 bg-brand-dark/50 hover:bg-brand-medium/30 border border-brand-light/5 rounded transition-colors"
              >
                <button
                  onClick={() => handleToggleLayerVisible(layer)}
                  className={`transition-colors ${layer.isVisible ? 'text-brand-light hover:text-white' : 'text-brand-light/30 hover:text-brand-light'}`}
                  title={layer.isVisible ? 'Hide layer' : 'Show layer'}
                >
                  {layer.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>

                <div className="flex-1 font-bold text-white flex items-center gap-2 truncate">
                  {layer.type === 'BACKGROUND' && <Map size={14} className="text-brand-light/50 shrink-0" />}
                  <span className="truncate">{layer.name}</span>
                </div>

                <button
                  onClick={() => handleToggleLayerLock(layer)}
                  className={`transition-all duration-300 ${layer.isLocked ? 'text-amber-400 hover:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'text-brand-light/50 hover:text-white'}`}
                  title={layer.isLocked ? 'Unlock layer' : 'Lock layer'}
                >
                  {layer.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>

                <div className="text-brand-light/30 cursor-grab active:cursor-grabbing px-1 hover:text-brand-light">
                  <GripVertical size={14} />
                </div>
              </div>
            ))}

            {(!currentScene?.layers?.length) && (
              <div className="text-center text-brand-light/50 p-4 italic text-xs">
                {currentScene ? 'Немає шарів у цій сцені' : 'Оберіть або створіть сцену'}
              </div>
            )}
          </div>

          {/* Bottom Toolbar */}
          <div className="flex border-t border-brand-light/10 bg-brand-medium/20 p-1 shrink-0">
            <button
              onClick={() => setIsCreateSceneModalOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-white hover:bg-brand-light/10 rounded transition-colors"
            >
              <Plus size={14} /> New scene
            </button>
            <div className="w-px bg-brand-light/10 my-1" />
            <button
              onClick={handleCreateLayer}
              disabled={!currentScene}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold text-white hover:bg-brand-light/10 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Layers size={14} /> New layer
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
        chatController={chatController}
        onEditScene={(scene) => setEditingScene(scene)}
      />
    </>
  );
}

SceneManager.propTypes = {
  chatController: PropTypes.object,
};
