import React, { useRef, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Application, extend } from '@pixi/react';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import GridLayer from './GridLayer';
import TokenLayer from './TokenLayer';
import BackgroundLayer from './BackgroundLayer';
import DraggableElement from './DraggableElement';
import DrawingLayer from './DrawingLayer';
import useBattlefieldStore from './useBattlefieldStore';
import useViewport from '../../hooks/useViewport';
import { ChevronRight } from 'lucide-react';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// Реєструємо Pixi-компоненти для @pixi/react
// Після extend() їх можна використовувати як JSX-теги нижнього регістру:
// <container>, <graphics>, <sprite>, <text>
extend({ Container, Graphics, Sprite, Text });

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
function BattlefieldContent({ screenWidth, screenHeight, viewport, vttConnection, isGM, onContextMenu, viewerId }) {
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
  const selectedDrawingId = useBattlefieldStore((s) => s.selectedDrawingId);
  const setSelectedDrawingId = useBattlefieldStore((s) => s.setSelectedDrawingId);

  const drawingTool = useBattlefieldStore(s => s.drawingTool);
  const drawingColor = useBattlefieldStore(s => s.drawingColor);
  const drawingThickness = useBattlefieldStore(s => s.drawingThickness);
  const drawPreviews = useBattlefieldStore(s => s.drawPreviews);
  const setDrawPreview = useBattlefieldStore(s => s.setDrawPreview);
  const removeDrawPreview = useBattlefieldStore(s => s.removeDrawPreview);
  const setTextPrompt = useBattlefieldStore(s => s.setTextPrompt);

  const localDrawingRef = useRef(null);
  const isDrawingRef = useRef(false);

  const setLocalDrawing = useCallback((drawing) => {
    localDrawingRef.current = drawing;
  }, []);

  // Гравці завжди бачать активну сцену. GM бачить те, що обрав (gmViewSceneId) або активну
  const viewedSceneId = isGM ? (gmViewSceneId || activeSceneId) : activeSceneId;
  const currentScene = viewedSceneId ? scenes[viewedSceneId] : null;

  useEffect(() => {
    // Очищаємо локальні малюнки та прев'ю при зміні сцени
    localDrawingRef.current = null;
    isDrawingRef.current = false;
    useBattlefieldStore.getState().clearAllPreviews();
  }, [currentScene?.id]);

  const currentGridSize = currentScene?.gridSize ?? globalGridSize;



  // --- Drawing Logic ---
  const handlePointerDown = useCallback((e) => {
    // Дозволяємо малювати тільки лівою кнопкою миші (button 0)
    if (e.button !== 0) return;

    if (!drawingTool) {
      setSelectedImageId(null);
      setSelectedDrawingId(null);
      return;
    }
    e.stopPropagation();
    isDrawingRef.current = true;
    
    // Отримуємо координати відносно контейнера (сцени)
    const localPos = e.data.getLocalPosition(e.currentTarget.parent);
    
    // Якщо вибрано текст, викликаємо кастомну модалку
    if (drawingTool === 'text') {
      setTextPrompt({ points: [localPos.x, localPos.y] });
      isDrawingRef.current = false;
      return;
    }

    const newDrawing = {
      type: drawingTool,
      points: [localPos.x, localPos.y],
      color: drawingColor,
      thickness: drawingThickness,
      userId: viewerId || 'me',
    };
    
    setLocalDrawing(newDrawing);
    const previewData = { ...newDrawing, sceneId: currentScene.id };
    setDrawPreview('me', previewData);
    vttConnection?.sendVttSceneDrawPreview?.(currentScene.id, viewerId || 'me', newDrawing);
  }, [drawingTool, currentScene, setSelectedImageId, setSelectedDrawingId, drawingColor, drawingThickness, setLocalDrawing, viewerId, setDrawPreview, vttConnection, setTextPrompt]);

  const handlePointerMove = useCallback((e) => {
    const localDrawing = localDrawingRef.current;
    if (!isDrawingRef.current || !localDrawing) return;

    const localPos = e.data.getLocalPosition(e.currentTarget.parent);

    setLocalDrawing({
      ...localDrawing,
      points: localDrawing.type === 'pencil'
        ? [...localDrawing.points, localPos.x, localPos.y]
        : [localDrawing.points[0], localDrawing.points[1], localPos.x, localPos.y]
    });
    
    const previewData = { ...localDrawingRef.current, sceneId: currentScene.id };
    setDrawPreview('me', previewData);
    vttConnection?.sendVttSceneDrawPreview?.(currentScene.id, viewerId || 'me', localDrawingRef.current);
  }, [currentScene, vttConnection, setDrawPreview, setLocalDrawing, viewerId]);

  const handlePointerUp = useCallback((e) => {
    const localDrawing = localDrawingRef.current;
    if (!isDrawingRef.current) return;
    if (e.stopPropagation) e.stopPropagation();
    isDrawingRef.current = false;

    if (localDrawing) {
      // Відправляємо фінальний малюнок
      if (localDrawing.points.length >= 4 || localDrawing.type === 'pencil' || localDrawing.type === 'text') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (localDrawing.type === 'circle') {
          const cx = localDrawing.points[0];
          const cy = localDrawing.points[1];
          const r = Math.sqrt(Math.pow(localDrawing.points[2] - cx, 2) + Math.pow(localDrawing.points[3] - cy, 2));
          minX = cx - r; maxX = cx + r;
          minY = cy - r; maxY = cy + r;
        } else if (localDrawing.type === 'text') {
          minX = localDrawing.points[0];
          maxX = localDrawing.points[0] + 100;
          minY = localDrawing.points[1];
          maxY = localDrawing.points[1] + 30;
        } else {
          for (let i = 0; i < localDrawing.points.length; i += 2) {
            const x = localDrawing.points[i];
            const y = localDrawing.points[i+1];
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        
        let width = maxX - minX;
        let height = maxY - minY;
        if (width < 2) width = 2;
        if (height < 2) height = 2;

        // Додаємо відступ (padding), щоб ручки resize не перекривали тонкі лінії
        width += localDrawing.thickness || 4;
        height += localDrawing.thickness || 4;

        const x = minX + (maxX - minX) / 2;
        const y = minY + (maxY - minY) / 2;

        const normalizedPoints = [];
        for (let i = 0; i < localDrawing.points.length; i += 2) {
          normalizedPoints.push(localDrawing.points[i] - x, localDrawing.points[i+1] - y);
        }

        const finalDrawing = {
          ...localDrawing,
          points: normalizedPoints,
          x, y, width, height, scaleX: 1, scaleY: 1, rotation: 0
        };

        vttConnection?.sendVttSceneAddDrawing?.(currentScene?.id, finalDrawing);
      }
    }
    
    setLocalDrawing(null);
    removeDrawPreview('me');
    vttConnection?.sendVttSceneDrawPreview?.(currentScene?.id, viewerId || 'me', null);
  }, [currentScene, vttConnection, removeDrawPreview, viewerId, setLocalDrawing]);

  const handlePointerCancel = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setLocalDrawing(null);
    removeDrawPreview('me');
    vttConnection?.sendVttSceneDrawPreview?.(currentScene?.id, viewerId || 'me', null);
  }, [currentScene, vttConnection, viewerId, setLocalDrawing, removeDrawPreview]);

  // Скидання малювання якщо мишка вийшла за межі
  const handlePointerUpOutside = handlePointerUp;

  /** Рендер сцени зі стану сцени (новий шлях) */
  const renderNewScene = () => (
    <>
      {/* 0. Безкінечний прозорий "стіл" (ловить кліки поза розміром сцени) */}
      <graphics
        eventMode="static"
        onPointerDown={() => {
          setSelectedImageId(null);
          setSelectedDrawingId(null);
        }}
        draw={(g) => {
          g.clear();
          g.rect(-100000, -100000, 200000, 200000);
          g.fill({ color: 0x000000, alpha: 0.001 });
        }}
      />

      {/* 1. Суцільний фон самої сцени (він перехоплює події малювання) 
          Збільшено до 100000 для можливості малювання поза межами сцени */}
      <graphics
        eventMode={drawingTool ? "static" : "auto"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerUpOutside={handlePointerUpOutside}
        onPointerCancel={handlePointerCancel}
        draw={(g) => {
          g.clear();
          // Зона для малювання (величезна)
          g.rect(-50000, -50000, 100000, 100000);
          g.fill({ color: 0x000000, alpha: 0.001 }); // Майже прозорий фон для захоплення подій
          
          // Візуальна границя самої сцени
          if (currentScene) {
            g.rect(0, 0, currentScene.width, currentScene.height);
            g.fill({ color: currentScene.backgroundColor ?? 0x243530 });
          }
        }}
      />

      {/* 2. Шари рендеряться в їхньому порядку з currentScene.layers */}
      {(() => {
        const layers = currentScene?.layers || [];
        return (
          <container sortableChildren={true}>
            {layers.map((layer, index) => (
              <container 
                key={layer.id} 
                zIndex={index} 
                visible={layer.isVisible !== false}
              >
                {layer.items?.filter(item => item.type === 'IMAGE').map((img) => (
                  <DraggableElement
                    key={img.id}
                    item={img}
                    isSelected={selectedImageId === img.id}
                    onSelect={() => setSelectedImageId(img.id)}
                    onUpdate={(id, updates) => vttConnection?.sendVttSceneUpdateImage?.(currentScene.id, id, updates)}
                    onPreview={(id, updates) => vttConnection?.sendVttScenePreviewImage?.(currentScene.id, id, updates)}
                    onContextMenu={onContextMenu}
                    viewport={viewport}
                    gridSize={globalGridSize}
                    isLocked={layer.isLocked || !isGM}
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

                {layer.type === 'GRID' && currentScene.gridEnabled !== false && (
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
                {layer.type === 'DRAWING' && (
                  <DrawingLayer 
                    drawings={layer.items}
                    drawPreviews={drawPreviews}
                    gridSize={currentGridSize}
                    selectedDrawingId={selectedDrawingId}
                    setSelectedDrawingId={setSelectedDrawingId}
                    vttConnection={vttConnection}
                    currentScene={currentScene}
                    viewport={viewport}
                    isLocked={layer.isLocked || !isGM}
                    onContextMenu={onContextMenu}
                  />
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
 * Головний компонент VttBattlefield.
 */
export default function VttBattlefield({ vttConnection, isGM, viewerId }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = useCallback((e, itemId) => {
    if (!isGM) return;
    const event = e.data?.originalEvent || e.nativeEvent || e;
    const { clientX, clientY } = event;
    
    // We adjust the click position by subtracting any offset if the container isn't full screen
    const rect = containerRef.current?.getBoundingClientRect();
    const x = clientX - (rect?.left || 0);
    const y = clientY - (rect?.top || 0);

    setContextMenu({ x, y, itemId });
  }, [isGM]);

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
  const selectedDrawingId = useBattlefieldStore((s) => s.selectedDrawingId);
  const setSelectedDrawingId = useBattlefieldStore((s) => s.setSelectedDrawingId);

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
      // Do not delete if typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace' || e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedImageId) {
          vttConnection?.sendVttSceneRemoveImage?.(currentScene?.id, selectedImageId);
          setSelectedImageId(null);
        }
        if (selectedDrawingId) {
          vttConnection?.sendVttSceneRemoveDrawing?.(currentScene.id, selectedDrawingId);
          setSelectedDrawingId(null);
        }
      }
    };globalThis.window.addEventListener('keydown', handleKeyDown);
    return () => globalThis.window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageId, selectedDrawingId, currentScene, vttConnection, setSelectedImageId, setSelectedDrawingId]);

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
              viewerId={viewerId}
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
              handleAdaptScene(contextMenu.itemId);
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
                    if (contextMenu.itemId?.startsWith('draw-')) {
                      vttConnection?.sendVttSceneUpdateDrawing?.(currentScene.id, contextMenu.itemId, { layerId: layer.id });
                    } else {
                      vttConnection?.sendVttSceneUpdateImage?.(currentScene.id, contextMenu.itemId, { layerId: layer.id });
                    }
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
              if (contextMenu.itemId?.startsWith('draw-')) {
                vttConnection?.sendVttSceneRemoveDrawing?.(currentScene.id, contextMenu.itemId);
              } else {
                vttConnection?.sendVttSceneRemoveImage?.(currentScene.id, contextMenu.itemId);
              }
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
  viewerId: PropTypes.string,
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
  viewerId: PropTypes.string,
};
