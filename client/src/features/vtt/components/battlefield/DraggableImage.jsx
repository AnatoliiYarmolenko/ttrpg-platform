import React, { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Assets } from 'pixi.js';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';
import { snapObjectToGrid } from '@/features/vtt/utils/vttUtils';

/**
 * usePixiTexture — завантаження текстури для зображення.
 * @param {string | null} imageUrl
 * @returns {import('pixi.js').Texture | null}
 */
function usePixiTexture(imageUrl) {
  const resolvedUrl = imageUrl ? resolveMediaUrl(imageUrl) : null;
  const [state, setState] = useState({ url: resolvedUrl, texture: null });

  if (state.url !== resolvedUrl) {
    setState({ url: resolvedUrl, texture: null });
  }

  useEffect(() => {
    if (!resolvedUrl) return;

    let cancelled = false;

    Assets.load(resolvedUrl)
      .then((tex) => {
        if (!cancelled) {
          setState({ url: resolvedUrl, texture: tex });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[DraggableImage] Failed to load:', resolvedUrl, err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedUrl]);

  return state.texture;
}

/** 
 * Допоміжна функція для обертання точки навколо 0,0 
 */
function rotatePoint(x, y, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos
  };
}

/**
 * DraggableImage — зображення-оверлей на канвасі VTT.
 *
 * Підтримує:
 * - Drag & Drop для переміщення
 * - Resize handles по кутах (пропорційне масштабування)
 * - Rotate handle зверху
 * - Відображення UI контролів ТІЛЬКИ коли isSelected = true
 *
 * @param {{
 *   item: { id: string, url: string, x: number, y: number, width: number, height: number, scaleX: number, scaleY: number, rotation: number },
 *   isSelected: boolean,
 *   onSelect: () => void,
 *   onUpdate: (imageId: string, updates: object) => void,
 *   onPreview: (imageId: string, updates: object) => void,
 *   onContextMenu: (e: object, imageId: string) => void,
 *   viewport: { x: number, y: number, scale: number },
 *   gridSize?: number,
 *   isLocked?: boolean
 * }} props
 */
export default function DraggableImage({ item, isSelected, onSelect, onUpdate, onPreview, onContextMenu, viewport, gridSize, isLocked = false }) {
  const texture = usePixiTexture(item.url);

  // Локальний стан для плавного drag/resize без затримки мережі
  const [localX, setLocalX] = useState(item.x);
  const [localY, setLocalY] = useState(item.y);
  const [localScaleX, setLocalScaleX] = useState(item.scaleX ?? 1);
  const [localScaleY, setLocalScaleY] = useState(item.scaleY ?? 1);
  const [localRotation, setLocalRotation] = useState(item.rotation ?? 0);

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);

  const [prevItem, setPrevItem] = useState({
    x: item.x,
    y: item.y,
    scaleX: item.scaleX,
    scaleY: item.scaleY,
    rotation: item.rotation,
  });

  if (
    item.x !== prevItem.x ||
    item.y !== prevItem.y ||
    item.scaleX !== prevItem.scaleX ||
    item.scaleY !== prevItem.scaleY ||
    item.rotation !== prevItem.rotation
  ) {
    setPrevItem({
      x: item.x,
      y: item.y,
      scaleX: item.scaleX,
      scaleY: item.scaleY,
      rotation: item.rotation,
    });
    if (!isDragging && !isResizing && !isRotating) {
      setLocalX(item.x);
      setLocalY(item.y);
      setLocalScaleX(item.scaleX ?? 1);
      setLocalScaleY(item.scaleY ?? 1);
      setLocalRotation(item.rotation ?? 0);
    }
  }

  const dragState = useRef(null);
  const resizeState = useRef(null);
  const rotateState = useRef(null);
  const debounceRef = useRef(null);
  const lastPreviewEmitRef = useRef(0);

  // Debounced send update to server (зберігається в БД)
  const sendUpdate = useCallback((updates) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate?.(item.id, updates);
    }, 200);
  }, [onUpdate, item.id]);

  // Throttled send preview (розсилається іншим гравцям без збереження в БД)
  const sendPreview = useCallback((updates) => {
    const now = Date.now();
    if (now - lastPreviewEmitRef.current > 33) {
      lastPreviewEmitRef.current = now;
      onPreview?.(item.id, updates);
    }
  }, [onPreview, item.id]);

  // ─── Drag handlers (Переміщення) ───────────────────────────────────────────────

  const rightClickStartRef = useRef(null);

  const onDragStart = useCallback((e) => {
    if (isLocked) return;
    const event = e.data?.global || e.global || e;
    
    // Якщо це правий клік (button 2)
    if (e.data?.button === 2 || e.button === 2 || e.nativeEvent?.button === 2) {
      // НЕ робимо stopPropagation(), щоб useViewport міг рухати сцену
      rightClickStartRef.current = { x: event.x, y: event.y };
      return;
    }

    onSelect(); // Виділяємо при кліку
    dragState.current = {
      startMouseX: event.x,
      startMouseY: event.y,
      startX: localX,
      startY: localY,
    };
    setIsDragging(true);
    e.stopPropagation?.();
  }, [localX, localY, onSelect, isLocked]);

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
    
    sendPreview({ x: newX, y: newY });
  }, [viewport.scale, sendPreview]);

  const onDragEnd = useCallback((e) => {
    // Перевірка на відпускання правої кнопки миші
    if (e && (e.data?.button === 2 || e.button === 2 || e.nativeEvent?.button === 2)) {
      if (rightClickStartRef.current) {
        const event = e.data?.global || e.global || e;
        const dx = event.x - rightClickStartRef.current.x;
        const dy = event.y - rightClickStartRef.current.y;
        const dist = Math.hypot(dx, dy);
        
        // Якщо майже не рухали мишкою (менше 5 пікселів) — це клік, відкриваємо меню
        if (dist < 5) {
          // Щоб запобігти миттєвому закриттю меню через глобальний клік:
          e.stopPropagation?.();
          e.data?.originalEvent?.stopPropagation?.();
          onContextMenu?.(e, item.id);
        }
        rightClickStartRef.current = null;
      }
      return;
    }

    if (!dragState.current) return;
    dragState.current = null;
    setIsDragging(false);
    
    // При відпусканні примагнічуємо до сітки
    const snapped = snapObjectToGrid(localX, localY, item.width, item.height, localScaleX, localScaleY, gridSize);
    setLocalX(snapped.x);
    setLocalY(snapped.y);
    setLocalScaleX(snapped.scaleX);
    setLocalScaleY(snapped.scaleY);
    
    sendUpdate({ x: snapped.x, y: snapped.y, scaleX: snapped.scaleX, scaleY: snapped.scaleY });
  }, [localX, localY, localScaleX, localScaleY, item.width, item.height, gridSize, sendUpdate, item.id, onContextMenu]);

  // ─── Resize handlers (Масштабування) ─────────────────────────────────────────────

  const onResizeStart = useCallback((e, cornerDirX, cornerDirY) => {
    // Локальні координати протилежного кута (опорна точка, що не рухається)
    const oppLocalX = -cornerDirX * (item.width * localScaleX) / 2;
    const oppLocalY = -cornerDirY * (item.height * localScaleY) / 2;
    
    // Переводимо протилежний кут у світові координати
    const rotatedOpp = rotatePoint(oppLocalX, oppLocalY, localRotation);
    const oppWorldX = localX + rotatedOpp.x;
    const oppWorldY = localY + rotatedOpp.y;
    
    // Локальні координати поточного кута (за який тягнуть)
    const dragLocalX = cornerDirX * (item.width * localScaleX) / 2;
    const dragLocalY = cornerDirY * (item.height * localScaleY) / 2;
    
    // Його координати у світі
    const rotatedDrag = rotatePoint(dragLocalX, dragLocalY, localRotation);
    const dragWorldX = localX + rotatedDrag.x;
    const dragWorldY = localY + rotatedDrag.y;
    
    // Початкова відстань між кутами
    const startDistance = Math.hypot(dragWorldX - oppWorldX, dragWorldY - oppWorldY);

    resizeState.current = {
      oppWorldX,
      oppWorldY,
      startDistance,
      startScaleX: localScaleX,
      startScaleY: localScaleY,
      cornerDirX,
      cornerDirY
    };
    setIsResizing(true);
    e.stopPropagation?.();
  }, [localX, localY, localScaleX, localScaleY, localRotation, item.width, item.height]);

  const onResizeMove = useCallback((e) => {
    if (!resizeState.current) return;
    const event = e.data?.global || e.global || e;
    const { oppWorldX, oppWorldY, startDistance, startScaleX, startScaleY, cornerDirX, cornerDirY } = resizeState.current;
    
    // Позиція миші у світових координатах
    const mouseWorldX = (event.x - viewport.x) / viewport.scale;
    const mouseWorldY = (event.y - viewport.y) / viewport.scale;
    
    // Щоб зберегти пропорції і уникнути спотворень при випадковому відведенні миші вбік,
    // проектуємо вектор миші на вектор напрямку діагоналі.
    
    // Вектор діагоналі у локальних координатах (без масштабу)
    const diagLocalX = cornerDirX * item.width;
    const diagLocalY = cornerDirY * item.height;
    
    // Обертаємо діагональ, щоб отримати її напрямок у світі
    const rotatedDiag = rotatePoint(diagLocalX, diagLocalY, localRotation);
    const diagLen = Math.hypot(rotatedDiag.x, rotatedDiag.y);
    
    // Нормалізований напрямок діагоналі
    const dirX = rotatedDiag.x / diagLen;
    const dirY = rotatedDiag.y / diagLen;
    
    // Вектор від протилежного кута до миші
    const mouseVecX = mouseWorldX - oppWorldX;
    const mouseVecY = mouseWorldY - oppWorldY;
    
    // Проекція миші на діагональ (це нова довжина діагоналі)
    const currentDistance = mouseVecX * dirX + mouseVecY * dirY;
    
    // Фактор масштабування відносно початкового стану
    let factor = currentDistance / startDistance;
    factor = Math.max(0.05, factor); // Запобігаємо вивертанню картинки
    
    const newScaleX = startScaleX * factor;
    const newScaleY = startScaleY * factor;
    
    // Обчислюємо новий центр так, щоб протилежний кут (oppWorld) залишився на місці
    const newOppLocalX = -cornerDirX * (item.width * newScaleX) / 2;
    const newOppLocalY = -cornerDirY * (item.height * newScaleY) / 2;
    
    const rotatedNewOpp = rotatePoint(newOppLocalX, newOppLocalY, localRotation);
    
    // C' = oppWorld - rotatedOppLocal'
    const newLocalX = oppWorldX - rotatedNewOpp.x;
    const newLocalY = oppWorldY - rotatedNewOpp.y;

    setLocalScaleX(newScaleX);
    setLocalScaleY(newScaleY);
    setLocalX(newLocalX);
    setLocalY(newLocalY);
    
    sendPreview({ x: newLocalX, y: newLocalY, scaleX: newScaleX, scaleY: newScaleY });
  }, [localRotation, item.width, item.height, viewport.x, viewport.y, viewport.scale, sendPreview]);

  const onResizeEnd = useCallback(() => {
    if (!resizeState.current) return;
    resizeState.current = null;
    setIsResizing(false);
    
    // Примагнічуємо після закінчення ресайзу
    const snapped = snapObjectToGrid(localX, localY, item.width, item.height, localScaleX, localScaleY, gridSize);
    setLocalX(snapped.x);
    setLocalY(snapped.y);
    setLocalScaleX(snapped.scaleX);
    setLocalScaleY(snapped.scaleY);
    
    sendUpdate({ x: snapped.x, y: snapped.y, scaleX: snapped.scaleX, scaleY: snapped.scaleY });
  }, [localX, localY, localScaleX, localScaleY, item.width, item.height, gridSize, sendUpdate]);

  // ─── Rotate handlers (Обертання) ───────────────────────────────────────────────

  const onRotateStart = useCallback((e) => {
    rotateState.current = true;
    setIsRotating(true);
    e.stopPropagation?.();
  }, []);

  const onRotateMove = useCallback((e) => {
    if (!rotateState.current) return;
    const event = e.data?.global || e.global || e;
    
    // Центр в екранних координатах
    const centerX = viewport.x + localX * viewport.scale;
    const centerY = viewport.y + localY * viewport.scale;
    
    const dx = event.x - centerX;
    const dy = event.y - centerY;
    
    // atan2 повертає кут. Оскільки ручка знаходиться зверху (в -Y локально),
    // нам потрібно додати PI/2, щоб кут був 0, коли курсор зверху.
    let angle = Math.atan2(dy, dx) + Math.PI / 2;
    setLocalRotation(angle);
    
    sendPreview({ rotation: angle });
  }, [localX, localY, viewport.x, viewport.y, viewport.scale, sendPreview]);

  const onRotateEnd = useCallback(() => {
    if (!rotateState.current) return;
    rotateState.current = false;
    setIsRotating(false);
    sendUpdate({ rotation: localRotation });
  }, [localRotation, sendUpdate]);

  if (!texture) return null;

  const displayWidth = item.width * localScaleX;
  const displayHeight = item.height * localScaleY;
  
  // Координати кутів (відносно центру 0,0)
  const halfW = displayWidth / 2;
  const halfH = displayHeight / 2;

  // Адаптивні розміри UI елементів (щоб вони завжди були однакового розміру на екрані, незалежно від зуму)
  const effectiveScale = viewport?.scale || 1;
  const handleSize = 12 / effectiveScale;        // Розмір ручок (12 екранних пікселів, зменшено на 25%)
  const rotateDist = 24 / effectiveScale;        // Відстань до ручки обертання
  const strokeWidth = 2 / effectiveScale;        // Товщина рамки
  // Для ще зручнішого клікабельного "хітбоксу" ручок, можна було б додати hitArea, 
  // але оскільки вони адаптивні (завжди 16px на екрані), по них вже дуже легко влучати.

  // Оформлення UI елементів
  const primaryColor = 0xffffff;
  const strokeColor = 0xfc6a03; // Оранжевий колір як на скріншоті

  let spriteCursor = "pointer";
  if (isLocked) {
    spriteCursor = "default";
  } else if (isSelected) {
    spriteCursor = "move";
  }

  return (
    <container 
      x={localX} 
      y={localY} 
      rotation={localRotation /* NOSONAR */}
      eventMode={isLocked ? "none" : "static"} /* NOSONAR */
      sortableChildren /* NOSONAR */
    >
      {/* Зображення */}
      {/* Sprite має anchor 0.5, тому він відцентрований у контейнері */}
      <sprite
        texture={texture /* NOSONAR */}
        width={displayWidth}
        height={displayHeight}
        anchor={0.5 /* NOSONAR */}
        eventMode="static" /* NOSONAR */
        cursor={spriteCursor}
        onPointerDown={onDragStart}
        onGlobalPointerMove={onDragMove /* NOSONAR */}
        onPointerUp={onDragEnd}
        onPointerUpOutside={onDragEnd /* NOSONAR */}
      />

      {/* Елементи керування (Тільки коли виділено і не заблоковано) */}
      {isSelected && !isLocked && (
        <container zIndex={10 /* NOSONAR */}>
          {/* Рамка навколо зображення */}
          <graphics
            draw={(g) => { /* NOSONAR */
              g.clear();
              g.rect(-halfW, -halfH, displayWidth, displayHeight);
              g.stroke({ width: strokeWidth, color: strokeColor, alpha: 0.8 });
              
              // Лінія до ручки обертання
              g.moveTo(0, -halfH);
              g.lineTo(0, -halfH - rotateDist);
              g.stroke({ width: strokeWidth, color: strokeColor, alpha: 0.8 });
            }}
          />

          {/* Ручка обертання (зверху) */}
          <graphics
            x={0}
            y={-halfH - rotateDist}
            eventMode="static" /* NOSONAR */
            cursor="pointer"
            onPointerDown={onRotateStart}
            onGlobalPointerMove={onRotateMove /* NOSONAR */}
            onPointerUp={onRotateEnd}
            onPointerUpOutside={onRotateEnd /* NOSONAR */}
            draw={(g) => { /* NOSONAR */
              g.clear();
              g.roundRect(-handleSize/2, -handleSize/2, handleSize, handleSize, 3 / effectiveScale);
              g.fill({ color: primaryColor });
            }}
          />

          {/* 4 Кутові ручки масштабування */}
          {[
            { x: -halfW, y: -halfH, cursor: 'nwse-resize', dirX: -1, dirY: -1 }, // Top-Left
            { x: halfW, y: -halfH, cursor: 'nesw-resize',  dirX: 1, dirY: -1 },  // Top-Right
            { x: halfW, y: halfH, cursor: 'nwse-resize',   dirX: 1, dirY: 1 },   // Bottom-Right
            { x: -halfW, y: halfH, cursor: 'nesw-resize',  dirX: -1, dirY: 1 },  // Bottom-Left
          ].map((corner) => (
            <graphics
              key={`${corner.dirX}_${corner.dirY}`}
              x={corner.x}
              y={corner.y}
              eventMode="static" /* NOSONAR */
              cursor={corner.cursor}
              onPointerDown={(e) => onResizeStart(e, corner.dirX, corner.dirY)}
              onGlobalPointerMove={onResizeMove /* NOSONAR */}
              onPointerUp={onResizeEnd}
              onPointerUpOutside={onResizeEnd /* NOSONAR */}
              draw={(g) => { /* NOSONAR */
                g.clear();
                g.roundRect(-handleSize/2, -handleSize/2, handleSize, handleSize, 3 / effectiveScale);
                g.fill({ color: primaryColor });
              }}
            />
          ))}
        </container>
      )}
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
    rotation: PropTypes.number,
  }).isRequired,
  isSelected: PropTypes.bool,
  onSelect: PropTypes.func,
  onUpdate: PropTypes.func,
  viewport: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
    scale: PropTypes.number,
  }).isRequired,
  gridSize: PropTypes.number,
  onPreview: PropTypes.func,
  onContextMenu: PropTypes.func,
  isLocked: PropTypes.bool,
};
