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
 *   chatController?: object
 * }} props
 */
function BattlefieldContent({ screenWidth, screenHeight, viewport, chatController, isGM }) {
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
    chatController?.sendVttSceneUpdateImage?.(currentScene.id, imageId, updates);
  }, [currentScene, chatController]);

  /** Плавне оновлення зображення без збереження в БД (для drag/resize) */
  const handleImagePreview = useCallback((imageId, updates) => {
    if (!currentScene) return;
    chatController?.sendVttScenePreviewImage?.(currentScene.id, imageId, updates);
  }, [currentScene, chatController]);

  /** Витягуємо зображення з BACKGROUND шару */
  const bgLayer = currentScene?.layers?.find((l) => l.type === 'BACKGROUND');
  const imageItems = bgLayer?.items || [];

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

      {/* 2. Зображення-оверлеї (поверх фону, під сіткою) */}
      {imageItems.map((item) => (
        <DraggableImage
          key={item.id}
          item={item}
          isSelected={item.id === selectedImageId}
          onSelect={() => setSelectedImageId(item.id)}
          onUpdate={handleImageUpdate}
          onPreview={handleImagePreview}
          viewport={viewport}
          gridSize={currentGridSize}
        />
      ))}

      {/* 3. Токени */}
      <TokenLayer
        tokens={Object.values(currentScene.tokens || {})}
        gridSize={currentGridSize}
        onTokenDrag={(tokenId, x, y) => {
          chatController?.sendVttTokenDrag?.(tokenId, x, y);
        }}
        onTokenDrop={(tokenId, x, y) => {
          chatController?.sendVttTokenDrop?.(currentScene.id, tokenId, x, y);
        }}
        viewport={viewport}
      />

      {/* 4. Сітка (завжди зверху) */}
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
          moveToken(tokenId, x, y);
          chatController?.sendVttTokenDrag?.(tokenId, x, y);
        }}
        onTokenDrop={(tokenId, x, y) => {
          moveToken(tokenId, x, y);
          chatController?.sendVttTokenDrop?.(tokenId, x, y);
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
  chatController: PropTypes.object,
};

/**
 * VttBattlefield — головний компонент ігрового поля.
 *
 * Відповідає за:
 * - Ініціалізацію PixiJS Application
 * - Viewport (Pan + Zoom) через useViewport хук
 * - Підключення BattlefieldContent всередину Application
 *
 * @param {{ chatController?: object }} props
 */
export default function VttBattlefield({ chatController, isGM }) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // useViewport тепер живе ТУТ і слухає DOM-події на containerRef
  // BattlefieldContent отримує viewport як prop (чистий стан, без DOM-доступу)
  const { viewport } = useViewport(containerRef);
  
  const selectedImageId = useBattlefieldStore((s) => s.selectedImageId);
  const setSelectedImageId = useBattlefieldStore((s) => s.setSelectedImageId);

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
      className="absolute inset-0"
      style={{ touchAction: 'none' }}
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
              chatController={chatController}
              isGM={isGM}
            />
          </Application>
        </ErrorBoundary>
      )}
    </div>
  );
}

VttBattlefield.propTypes = {
  chatController: PropTypes.object,
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
  chatController: PropTypes.object,
  isGM: PropTypes.bool,
};
