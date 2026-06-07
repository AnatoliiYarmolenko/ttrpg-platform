import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Assets } from 'pixi.js';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';

/**
 * usePixiTexture — завантаження текстури для зображення.
 * @param {string | null} imageUrl
 * @returns {import('pixi.js').Texture | null}
 */
function usePixiTexture(imageUrl) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    if (!imageUrl) {
      setTexture(null);
      return;
    }

    let cancelled = false;
    setTexture(null);

    const fullUrl = resolveMediaUrl(imageUrl);

    Assets.load(fullUrl)
      .then((tex) => {
        if (!cancelled) setTexture(tex);
      })
      .catch((err) => {
        if (!cancelled) console.error('[DraggableImage] Failed to load:', fullUrl, err);
      });

    return () => { cancelled = true; };
  }, [imageUrl]);

  return texture;
}

const HANDLE_SIZE = 14; // розмір ручки масштабування (в world px)

/**
 * DraggableImage — зображення-оверлей на канвасі VTT.
 *
 * Підтримує:
 * - Drag & Drop для переміщення
 * - Resize handle у нижньому-правому куті для масштабування
 *
 * @param {{
 *   item: { id: string, url: string, x: number, y: number, width: number, height: number, scaleX: number, scaleY: number },
 *   onUpdate: (imageId: string, updates: object) => void,
 *   viewport: { x: number, y: number, scale: number }
 * }} props
 */
export default function DraggableImage({ item, onUpdate, viewport }) {
  const texture = usePixiTexture(item.url);

  // Локальний стан для плавного drag/resize без затримки мережі
  const [localX, setLocalX] = useState(item.x);
  const [localY, setLocalY] = useState(item.y);
  const [localScaleX, setLocalScaleX] = useState(item.scaleX ?? 1);
  const [localScaleY, setLocalScaleY] = useState(item.scaleY ?? 1);

  // Синхронізуємо з серверними даними коли вони змінюються
  useEffect(() => {
    setLocalX(item.x);
    setLocalY(item.y);
    setLocalScaleX(item.scaleX ?? 1);
    setLocalScaleY(item.scaleY ?? 1);
  }, [item.x, item.y, item.scaleX, item.scaleY]);

  const dragState = useRef(null);
  const resizeState = useRef(null);
  const debounceRef = useRef(null);

  // Debounced send update to server
  const sendUpdate = useCallback((updates) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate?.(item.id, updates);
    }, 200);
  }, [onUpdate, item.id]);

  // ─── Drag handlers ───────────────────────────────────────────────

  const onDragStart = useCallback((e) => {
    const event = e.data?.global || e.global || e;
    dragState.current = {
      startMouseX: event.x,
      startMouseY: event.y,
      startX: localX,
      startY: localY,
    };
    e.stopPropagation?.();
  }, [localX, localY]);

  const onDragMove = useCallback((e) => {
    if (!dragState.current) return;
    const event = e.data?.global || e.global || e;
    const scale = viewport.scale || 1;
    const dx = (event.x - dragState.current.startMouseX) / scale;
    const dy = (event.y - dragState.current.startMouseY) / scale;
    const newX = dragState.current.startX + dx;
    const newY = dragState.current.startY + dy;
    setLocalX(newX);
    setLocalY(newY);
  }, [viewport.scale]);

  const onDragEnd = useCallback(() => {
    if (!dragState.current) return;
    dragState.current = null;
    sendUpdate({ x: localX, y: localY });
  }, [localX, localY, sendUpdate]);

  // ─── Resize handlers ─────────────────────────────────────────────

  const onResizeStart = useCallback((e) => {
    const event = e.data?.global || e.global || e;
    resizeState.current = {
      startMouseX: event.x,
      startMouseY: event.y,
      startScaleX: localScaleX,
      startScaleY: localScaleY,
    };
    e.stopPropagation?.();
  }, [localScaleX, localScaleY]);

  const onResizeMove = useCallback((e) => {
    if (!resizeState.current) return;
    const event = e.data?.global || e.global || e;
    const scale = viewport.scale || 1;
    const dx = (event.x - resizeState.current.startMouseX) / scale;

    // Пропорційне масштабування: обчислюємо множник за зміною X
    const origWidth = item.width * resizeState.current.startScaleX;
    const factor = Math.max(0.05, (origWidth + dx) / origWidth);

    const newScaleX = resizeState.current.startScaleX * factor;
    const newScaleY = resizeState.current.startScaleY * factor;

    setLocalScaleX(newScaleX);
    setLocalScaleY(newScaleY);
  }, [viewport.scale, item.width]);

  const onResizeEnd = useCallback(() => {
    if (!resizeState.current) return;
    resizeState.current = null;
    sendUpdate({ scaleX: localScaleX, scaleY: localScaleY });
  }, [localScaleX, localScaleY, sendUpdate]);

  if (!texture) return null;

  const displayWidth = item.width * localScaleX;
  const displayHeight = item.height * localScaleY;

  return (
    <container x={localX} y={localY} eventMode="static" sortableChildren>
      {/* Зображення */}
      <sprite
        texture={texture}
        width={displayWidth}
        height={displayHeight}
        eventMode="static"
        cursor="move"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerUpOutside={onDragEnd}
      />

      {/* Рамка навколо зображення */}
      <graphics
        zIndex={1}
        draw={(g) => {
          g.clear();
          g.setStrokeStyle({ width: 2, color: 0xfbbf24, alpha: 0.6 });
          g.rect(0, 0, displayWidth, displayHeight);
          g.stroke();
        }}
      />

      {/* Ручка масштабування (нижній правий кут) */}
      <graphics
        zIndex={2}
        x={displayWidth - HANDLE_SIZE}
        y={displayHeight - HANDLE_SIZE}
        eventMode="static"
        cursor="nwse-resize"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerUpOutside={onResizeEnd}
        draw={(g) => {
          g.clear();
          // Фон ручки
          g.rect(0, 0, HANDLE_SIZE, HANDLE_SIZE);
          g.fill({ color: 0xfbbf24, alpha: 0.9 });
          // Діагональні лінії (візуальний індикатор resize)
          g.setStrokeStyle({ width: 1.5, color: 0x000000, alpha: 0.5 });
          g.moveTo(HANDLE_SIZE * 0.3, HANDLE_SIZE * 0.9);
          g.lineTo(HANDLE_SIZE * 0.9, HANDLE_SIZE * 0.3);
          g.stroke();
          g.moveTo(HANDLE_SIZE * 0.55, HANDLE_SIZE * 0.9);
          g.lineTo(HANDLE_SIZE * 0.9, HANDLE_SIZE * 0.55);
          g.stroke();
        }}
      />
    </container>
  );
}

DraggableImage.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
    x: PropTypes.number,
    y: PropTypes.number,
    width: PropTypes.number,
    height: PropTypes.number,
    scaleX: PropTypes.number,
    scaleY: PropTypes.number,
  }).isRequired,
  onUpdate: PropTypes.func,
  viewport: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    scale: PropTypes.number,
  }).isRequired,
};
