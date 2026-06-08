import React, { useRef, useCallback, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { extend } from '@pixi/react';
import { Graphics, Container } from 'pixi.js';
import { snapObjectToGrid } from '../../utils/vttUtils';

extend({ Graphics, Container });

/**
 * useTokenDrag — хук логіки перетягування токена.
 *
 * Інкапсулює:
 * - Відстеження стану dragging через ref (уникає stale closures)
 * - Throttle WebSocket-подій до ~30fps
 * - Snap to grid при відпусканні
 * - Синхронізацію позиції з зовнішнім станом
 *
 * @param {{
 *   token: import('../../types/vtt.types').Token,
 *   viewport: import('../../types/vtt.types').Viewport,
 *   snapToGrid: (x: number, y: number) => { x: number, y: number },
 *   onDrag?: (id: string, x: number, y: number) => void,
 *   onDrop?: (id: string, x: number, y: number) => void,
 * }} options
 * @returns {{
 *   pos: { x: number, y: number },
 *   handlePointerDown: (e: any) => void,
 *   handlePointerMove: (e: any) => void,
 *   handlePointerUp: () => void,
 * }}
 */
function useTokenDrag({ token, viewport, gridSize, onDrag, onDrop }) {
  const [pos, setPos] = useState({ x: token.x, y: token.y });

  // Зберігаємо поточну позицію у ref для доступу без stale closure
  const posRef = useRef(pos);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const lastEmitRef = useRef(0);

  // Синхронізація з зовнішніми змінами (наприклад, інший гравець перемістив токен)
  useEffect(() => {
    if (!draggingRef.current) {
      const newPos = { x: token.x, y: token.y };
      setPos(newPos);
      posRef.current = newPos;
    }
  }, [token.x, token.y]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return; // Тільки ліва кнопка
    draggingRef.current = true;

    // e.global — PixiJS v8 API (v7 мав e.data.global)
    const globalPos = e.global;
    if (globalPos) {
      offsetRef.current = {
        x: posRef.current.x - (globalPos.x - viewport.x) / viewport.scale,
        y: posRef.current.y - (globalPos.y - viewport.y) / viewport.scale,
      };
    }

    e.stopPropagation?.();
  }, [viewport]);

  const handlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return;

    const globalPos = e.global;
    if (!globalPos) return;

    const worldX = (globalPos.x - viewport.x) / viewport.scale + offsetRef.current.x;
    const worldY = (globalPos.y - viewport.y) / viewport.scale + offsetRef.current.y;

    const newPos = { x: worldX, y: worldY };
    setPos(newPos);
    posRef.current = newPos;

    // Throttle WebSocket-подій до ~30fps
    const now = Date.now();
    if (now - lastEmitRef.current > 33) {
      lastEmitRef.current = now;
      onDrag?.(token.id, worldX, worldY);
    }
  }, [viewport, onDrag, token.id]);

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;

    // Використовуємо posRef.current щоб уникнути stale closure
    // Токен за замовчуванням має розмір 1x1 клітинку
    const width = gridSize * (token.size || 1);
    const height = gridSize * (token.size || 1);
    const snapped = snapObjectToGrid(posRef.current.x, posRef.current.y, width, height, 1, 1, gridSize);
    setPos(snapped);
    posRef.current = snapped;
    onDrop?.(token.id, snapped.x, snapped.y);
  }, [gridSize, token.size, onDrop, token.id]);

  return { pos, handlePointerDown, handlePointerMove, handlePointerUp };
}

/**
 * TokenLayer — шар токенів на ігровому полі.
 *
 * @param {{
 *   tokens: import('../../types/vtt.types').Token[],
 *   gridSize: number,
 *   onTokenDrag: (id: string, x: number, y: number) => void,
 *   onTokenDrop: (id: string, x: number, y: number) => void,
 *   viewport: import('../../types/vtt.types').Viewport,
 * }} props
 */
export default function TokenLayer({ tokens, gridSize, onTokenDrag, onTokenDrop, viewport }) {
  return (
    <container>
      {tokens.map((token) => (
        <Token
          key={token.id}
          token={token}
          gridSize={gridSize}
          onDrag={onTokenDrag}
          onDrop={onTokenDrop}
          viewport={viewport}
        />
      ))}
    </container>
  );
}

TokenLayer.propTypes = {
  tokens: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    color: PropTypes.number,
  })).isRequired,
  gridSize: PropTypes.number.isRequired,
  onTokenDrag: PropTypes.func.isRequired,
  onTokenDrop: PropTypes.func.isRequired,
  viewport: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    scale: PropTypes.number.isRequired,
  }).isRequired,
};

/**
 * Token — окремий токен на полі.
 *
 * @param {{
 *   token: import('../../types/vtt.types').Token,
 *   gridSize: number,
 *   onDrag: (id: string, x: number, y: number) => void,
 *   onDrop: (id: string, x: number, y: number) => void,
 *   viewport: import('../../types/vtt.types').Viewport,
 * }} props
 */
function Token({ token, gridSize, onDrag, onDrop, viewport }) {
  const { pos, handlePointerDown, handlePointerMove, handlePointerUp } = useTokenDrag({
    token,
    viewport,
    gridSize,
    onDrag,
    onDrop,
  });

  const tokenRadius = gridSize * 0.4;

  const drawToken = useCallback(
    (g) => {
      g.clear();

      // Тінь токена
      g.circle(2, 2, tokenRadius);
      g.fill({ color: 0x000000, alpha: 0.3 });

      // Тіло токена
      g.circle(0, 0, tokenRadius);
      g.fill({ color: token.color || 0xe74c3c });

      // Обводка токена (окремий shape — щоб stroke не конфліктував з fill)
      g.circle(0, 0, tokenRadius);
      g.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });

      // Центральна точка (маркер)
      g.circle(0, 0, tokenRadius * 0.2);
      g.fill({ color: 0xffffff, alpha: 0.6 });
    },
    [tokenRadius, token.color]
  );

  return (
    <graphics
      draw={drawToken /* NOSONAR */}
      x={pos.x}
      y={pos.y}
      eventMode="static" /* NOSONAR */
      cursor="pointer"
      onPointerDown={handlePointerDown}
      onGlobalPointerMove={handlePointerMove /* NOSONAR */}
      onPointerUp={handlePointerUp}
      onPointerUpOutside={handlePointerUp /* NOSONAR */}
    />
  );
}

Token.propTypes = {
  token: PropTypes.shape({
    id: PropTypes.string.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    color: PropTypes.number,
    size: PropTypes.number,
  }).isRequired,
  gridSize: PropTypes.number.isRequired,
  onDrag: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
  viewport: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    scale: PropTypes.number.isRequired,
  }).isRequired,
};
