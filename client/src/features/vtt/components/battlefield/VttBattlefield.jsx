import React, { useRef, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite } from 'pixi.js';
import GridLayer from './GridLayer';
import TokenLayer from './TokenLayer';
import BackgroundLayer from './BackgroundLayer';
import DraggableImage from './DraggableImage';
import useBattlefieldStore from './useBattlefieldStore';
import useViewport from '../../hooks/useViewport';
import { ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Реєструємо Pixi-компоненти для @pixi/react
// Після extend() їх можна використовувати як JSX-теги нижнього регістру:
// <container>, <graphics>, <sprite>
extend({ Container, Graphics, Sprite });

/**
 * BattlefieldContent — внутрішній Pixi-компонент.
 *
 * Рендерить сцену, сітку та токени. Отримує готовий viewport ззовні
 * (від батьківського VttBattlefield через useViewport хук).
 *
 * @param {{
 *   screenWidth: number,
 *   screenHeight: number,
 *   viewport: import('../../types/vtt.types').Viewport,
 *   vttConnection?: object
 * }} props
 */
function BattlefieldContent({ screenWidth, screenHeight, viewport, vttConnection, isGM, onContextMenu }) {
  const globalGridSize = useBattlefieldStore((s) => s.gridSize);
  const backgroundUrl = useBattlefieldStore((s) => s.backgroundUrl);
  const tokens = useBattlefieldStore((s) => s.tokens);
  const moveToken = useBattlefieldStore((s) => s.moveToken);
  const mapWidth = useBattlefieldStore((s) => s.mapWidth);
  const mapHeight = useBattlefieldStore((s) => s.mapHeight);

  const activeSceneId = useBattlefieldStore((s) => s.activeSceneId);
  const gmViewSceneId = useBattlefieldStore((s) => s.gmViewSceneId);
  const scenes = useBattlefieldStore((s) => s.scenes);
  const selectedImageId = useBattlefieldStore((s) => s.selectedImageId);
  const setSelectedImageId = useBattlefieldStore((s) => s.setSelectedImageId);

  // Гравці завжди бачать активну сцену. GM бачить те, що обрав (gmViewSceneId) або активну
  const viewedSceneId = isGM ? (gmViewSceneId || activeSceneId) : activeSceneId;
  const currentScene = viewedSceneId ? scenes[viewedSceneId] : null;

  const currentGridSize = currentScene?.gridSize ?? globalGridSize;

  /** Оновити позицію/масштаб зображення-оверлея через WebSocket */
  const handleImageUpdate = useCallback((imageId, updates) => {
    if (!currentScene) return;
    vttConnection?.sendVttSceneUpdateImage?.(currentScene.id, imageId, updates);
  }, [currentScene, vttConnection]);

  const handleImagePreview = useCallback((imageId, updates) => {
    if (!currentScene?.id) return;
    vttConnection?.sendVttScenePreviewImage?.(currentScene.id, imageId, updates);
  }, [currentScene, vttConnection]);

  /** Витягуємо зображення з BACKGROUND шару для сумісності, але тепер рендеримо все циклом */

  /** Рендер сцени зі стану сцени (новий шлях) */
  const renderNewScene = () => (
    <>
      {/* 0. Безкінечний прозорий "стіл" (ловить кліки поза розміром сцени) */}
      <graphics
        eventMode="static"
        onPointerDown={() => setSelectedImageId(null)}
        draw={(g) => {
          g.clear();
          g.rect(-100000, -100000, 200000, 200000);
          g.fill({ color: 0x000000, alpha: 0.001 });
        }}
      />

      {/* 1. Суцільний фон самої сцени */}
      <graphics
        eventMode="static"
        onPointerDown={() => setSelectedImageId(null)}
        draw={(g) => {
          g.clear();
          g.rect(0, 0, currentScene.width, currentScene.height);
          g.fill({ color: currentScene.backgroundColor ?? 0x243530 });
        }}
      />

      {/* 2. Шари рендеряться в їхньому порядку з currentScene.layers */}
      {(() => {
        const layers = currentScene?.layers || [];
        const hasDrawings = layers.some(l => l.type === 'DRAWING');

        return (
          <container sortableChildren={true}>
            {/* Fallback: якщо шару Drawings немає, малюємо сітку просто так */}
            {!hasDrawings && currentScene.gridEnabled !== false && (
               <container zIndex={999}>
                 <GridLayer
                   screenWidth={screenWidth}
                   screenHeight={screenHeight}
                   gridSize={currentGridSize}
                   viewport={viewport}
                   mapWidth={currentScene.width}
                   mapHeight={currentScene.height}
                   gridType={currentScene.gridType}
                   gridColor={currentScene.gridColor}
                   gridOpacity={currentScene.gridOpacity}
                 />
               </container>
            )}

            {layers.map((layer, index) => (
              <container 
                key={layer.id} 
                zIndex={index} 
                visible={layer.isVisible !== false}
              >
                {layer.items?.map((item) => (
                  <DraggableImage
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedImageId}
                    onSelect={() => setSelectedImageId(item.id)}
                    onUpdate={handleImageUpdate}
                    onPreview={handleImagePreview}
                    onContextMenu={onContextMenu}
                    viewport={viewport}
                    gridSize={currentGridSize}
                    isLocked={layer.isLocked === true}
                  />
                ))}

                {layer.type === 'TOKEN' && (
                  <TokenLayer
                    tokens={Object.values(currentScene.tokens || {})}
                    gridSize={currentGridSize}
                    onTokenDrag={(tokenId, x, y) => {
                      vttConnection?.sendVttTokenDrag?.(tokenId, x, y);
                    }}
                    onTokenDrop={(tokenId, x, y) => {
                      vttConnection?.sendVttTokenDrop?.(currentScene.id, tokenId, x, y);
                    }}
                    viewport={viewport}
                    isLocked={layer.isLocked === true}
                  />
                )}

                {layer.type === 'DRAWING' && (
                  <>
                    {/* Сітка жорстко прив'язана до шару Drawings */}
                    {currentScene.gridEnabled !== false && (
                      <GridLayer
                        screenWidth={screenWidth}
                        screenHeight={screenHeight}
                        gridSize={currentGridSize}
                        viewport={viewport}
                        mapWidth={currentScene.width}
                        mapHeight={currentScene.height}
                        gridType={currentScene.gridType}
                        gridColor={currentScene.gridColor}
                        gridOpacity={currentScene.gridOpacity}
                      />
                    )}
                  </>
                )}
              </container>
            ))}
          </container>
        );
      })()}
    </>
  );

  /** Рендер у legacy-режимі (без сцен — для зворотної сумісності) */
  const renderLegacyScene = () => (
    <>
      <BackgroundLayer imageUrl={backgroundUrl} width={mapWidth} height={mapHeight} />
      {backgroundUrl && (
        <GridLayer
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          gridSize={globalGridSize}
          viewport={viewport}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
        />
      )}
      <TokenLayer
        tokens={tokens}
        gridSize={globalGridSize}
        onTokenDrag={(tokenId, x, y) => {
          vttConnection?.sendVttTokenDrag?.(tokenId, x, y);
        }}
        onTokenDrop={(tokenId, x, y) => {
          moveToken(tokenId, x, y);
          vttConnection?.sendVttTokenDrop?.(tokenId, x, y);
        }}
        viewport={viewport}
      />
    </>
  );

  return (
    <container x={viewport.x} y={viewport.y} scale={viewport.scale}>
      {currentScene ? renderNewScene() : renderLegacyScene()}
    </container>
  );
}

BattlefieldContent.propTypes = {
  screenWidth: PropTypes.number.isRequired,
  screenHeight: PropTypes.number.isRequired,
  viewport: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    scale: PropTypes.number.isRequired,
  }).isRequired,
  vttConnection: PropTypes.object,
};

/**
 * VttBattlefield — головний компонент ігрового поля.
 *
 * Відповідає за:
 * - Ініціалізацію PixiJS Application
 * - Viewport (Pan + Zoom) через useViewport хук
 * - Підключення BattlefieldContent всередину Application
 *
 * @param {{ vttConnection?: object }} props
 */
export default function VttBattlefield({ vttConnection, isGM }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = useCallback((e, imageId) => {
    const originalEvent = e.data?.originalEvent || e.nativeEvent || e;
    const clientX = originalEvent.clientX;
    const clientY = originalEvent.clientY;
    setContextMenu({ x: clientX, y: clientY, imageId });
  }, []);

  // Close context menu on any click
  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    
    // Затримуємо додавання слухача, щоб поточний клік (який відкрив меню) його не закрив
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleClose);
      document.addEventListener('mousedown', handleClose);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleClose);
      document.removeEventListener('mousedown', handleClose);
    };
  }, [contextMenu]);

  // useViewport тепер живе ТУТ і слухає DOM-події на containerRef
  // BattlefieldContent отримує viewport як prop (чистий стан, без DOM-доступу)
  const { viewport } = useViewport(containerRef);
  
  const activeSceneId = useBattlefieldStore((s) => s.activeSceneId);
  const gmViewSceneId = useBattlefieldStore((s) => s.gmViewSceneId);
  const viewedSceneId = isGM ? (gmViewSceneId || activeSceneId) : activeSceneId;
  const scenes = useBattlefieldStore((s) => s.scenes);
  const currentScene = viewedSceneId && scenes ? scenes[viewedSceneId] : null;
  
  const selectedImageId = useBattlefieldStore((s) => s.selectedImageId);
  const setSelectedImageId = useBattlefieldStore((s) => s.setSelectedImageId);

  const handleDeleteImage = useCallback((imageId) => {
    if (!viewedSceneId || !imageId) return;
    vttConnection?.sendVttSceneRemoveImage?.(viewedSceneId, imageId);
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
    }
  }, [viewedSceneId, vttConnection, selectedImageId, setSelectedImageId]);

  const handleAdaptScene = useCallback((imageId) => {
    if (!currentScene || !imageId) return;
    
    // Знаходимо зображення в поточному BACKGROUND шарі
    const bgLayer = currentScene.layers?.find((l) => l.type === 'BACKGROUND');
    const imageItem = bgLayer?.items?.find((i) => i.id === imageId);
    if (!imageItem) return;

    // Вираховуємо реальні розміри фото з урахуванням масштабу
    const newWidth = Math.round(imageItem.width * (imageItem.scaleX || 1));
    const newHeight = Math.round(imageItem.height * (imageItem.scaleY || 1));

    // Оновлюємо розміри сцени
    vttConnection?.sendVttSceneUpdate?.(currentScene.id, { 
      width: newWidth, 
      height: newHeight 
    });

    // Центруємо картинку точно по центру нової сцени, щоб вона ідеально її заповнювала
    vttConnection?.sendVttSceneUpdateImage?.(currentScene.id, imageId, {
      x: newWidth / 2,
      y: newHeight / 2,
      rotation: 0 // Скидаємо поворот, щоб вона рівно стала в сцену
    });

    setContextMenu(null);
  }, [currentScene, vttConnection]);

  // Обробка видалення через клавіатуру
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ігноруємо натискання, якщо користувач вводить текст у поле
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedImageId) {
        handleDeleteImage(selectedImageId);
      }
    };
    
    globalThis.window.addEventListener('keydown', handleKeyDown);
    return () => globalThis.window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, handleDeleteImage]);

  // Скидання виділення зображення-оверлея при кліку поза канвасом VTT
  useEffect(() => {
    if (!selectedImageId) return;

    const handleOutsideClick = (e) => {
      // Якщо клік був у межах контейнера (наприклад, сам canvas) — 
      // ігноруємо, оскільки PixiJS має власну логіку (клік по фону).
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSelectedImageId(null);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    // Також на всяк випадок 'mousedown' для старих браузерів
    document.addEventListener('mousedown', handleOutsideClick);
    
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedImageId, setSelectedImageId]);

  // Відстежуємо розмір контейнера через ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.floor(width), height: Math.floor(height) });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      role="application"
      className="absolute inset-0"
      style={{ touchAction: 'none' }}
      onContextMenu={(e) => {
        // Prevent default browser context menu globally within VTT
        e.preventDefault();
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <ErrorBoundary>
          <Application
            width={dimensions.width}
            height={dimensions.height}
            backgroundAlpha={0}
            antialias
            autoDensity
            resolution={window.devicePixelRatio || 1}
          >
            <BattlefieldContent
              screenWidth={dimensions.width}
              screenHeight={dimensions.height}
              viewport={viewport}
              vttConnection={vttConnection}
              isGM={isGM}
              onContextMenu={handleContextMenu}
            />
          </Application>
        </ErrorBoundary>
      )}

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div 
          role="menu"
          tabIndex={-1}
          className="absolute z-[100] border border-brand-light/20 rounded-lg shadow-[0_8px_30px_rgba(22,74,65,0.6)] min-w-[160px] text-brand-light text-sm flex flex-col py-1"
          style={{ 
            top: contextMenu.y, 
            left: contextMenu.x,
            background: 'rgba(22, 36, 34, 0.5)', 
            backdropFilter: 'blur(24px)'
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button 
            className="px-4 py-2 text-left hover:bg-brand-medium/70 hover:text-white transition-colors" 
            onClick={() => {
              handleAdaptScene(contextMenu.imageId);
              setContextMenu(null);
            }}
          >
            Адаптувати сцену
          </button>
          
          <div className="relative group">
            <button className="w-full px-4 py-2 text-left hover:bg-brand-medium/70 hover:text-white transition-colors flex justify-between items-center">
              <span>Змінити шар</span>
              <ChevronRight size={14} className="opacity-50" />
            </button>
            <div className="absolute left-full top-0 hidden group-hover:flex flex-col min-w-[150px] bg-[#162422]/90 backdrop-blur-xl border border-brand-light/20 rounded-lg shadow-xl py-1">
              {currentScene?.layers?.map(layer => (
                <button
                  key={layer.id}
                  className="px-4 py-2 text-left hover:bg-brand-medium/70 hover:text-white transition-colors truncate"
                  onClick={() => {
                    vttConnection?.sendVttSceneUpdateImage?.(currentScene.id, contextMenu.imageId, { layerId: layer.id });
                    setContextMenu(null);
                  }}
                >
                  {layer.name || 'Шар'}
                </button>
              ))}
            </div>
          </div>
          
          <button className="px-4 py-2 text-left hover:bg-brand-medium/70 hover:text-white transition-colors" onClick={() => setContextMenu(null)}>Змінити Z-індекс</button>
          <button className="px-4 py-2 text-left hover:bg-brand-medium/70 hover:text-white transition-colors" onClick={() => setContextMenu(null)}>Передати контроль</button>
          <div className="h-px bg-brand-light/10 my-1 mx-2" />
          <button 
            className="px-4 py-2 text-left text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors" 
            onClick={() => {
              handleDeleteImage(contextMenu.imageId);
              setContextMenu(null);
            }}
          >
            Видалити
          </button>
        </div>
      )}
    </div>
  );
}

VttBattlefield.propTypes = {
  vttConnection: PropTypes.object,
  isGM: PropTypes.bool,
};

BattlefieldContent.propTypes = {
  screenWidth: PropTypes.number.isRequired,
  screenHeight: PropTypes.number.isRequired,
  viewport: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    scale: PropTypes.number.isRequired,
  }).isRequired,
  vttConnection: PropTypes.object,
  isGM: PropTypes.bool,
  onContextMenu: PropTypes.func,
};
