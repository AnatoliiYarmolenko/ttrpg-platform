import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { extend } from '@pixi/react';
import { Graphics, Container } from 'pixi.js';

extend({ Graphics, Container });

/**
 * GridLayer — шар квадратної сітки.
 *
 * Малює сітку ліній відповідно до поточного viewport.
 * Видимі лінії обчислюються динамічно (не малюється вся карта — тільки
 * та частина, яка потрапляє у видиму область екрана).
 *
 * @param {{
 *   screenWidth: number,
 *   screenHeight: number,
 *   gridSize: number,
 *   viewport: import('../../types/vtt.types').Viewport,
 *   mapWidth?: number | null,
 *   mapHeight?: number | null
 * }} props
 */
const isHexWithinBounds = (cx, cy, R, mapWidth, mapHeight) => {
  if (mapWidth == null || mapHeight == null) return true;
  return cx >= -R && cx <= mapWidth + R && cy >= -R && cy <= mapHeight + R;
};

const drawSingleHexagon = (g, cx, cy, R) => {
  g.moveTo(cx + R * Math.cos(Math.PI / 6), cy + R * Math.sin(Math.PI / 6));
  for (let i = 1; i <= 6; i++) {
    const angle = Math.PI / 6 + i * Math.PI / 3;
    g.lineTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
  }
};

const drawHexagonalGrid = (g, { gridSize, worldTop, worldBottom, worldLeft, worldRight, mapWidth, mapHeight }) => {
  const R = gridSize / 2;
  const colWidth = Math.sqrt(3) * R;
  const rowHeight = 1.5 * R;

  const minRow = Math.floor(worldTop / rowHeight) - 1;
  const maxRow = Math.ceil(worldBottom / rowHeight) + 1;
  const minCol = Math.floor(worldLeft / colWidth) - 1;
  const maxCol = Math.ceil(worldRight / colWidth) + 1;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const cx = c * colWidth + (r % 2 === 0 ? 0 : colWidth / 2);
      const cy = r * rowHeight;

      if (isHexWithinBounds(cx, cy, R, mapWidth, mapHeight)) {
        drawSingleHexagon(g, cx, cy, R);
      }
    }
  }
};

const drawSquareGrid = (g, { gridSize, worldTop, worldBottom, worldLeft, worldRight, mapWidth, mapHeight }) => {
  let startX = Math.floor(worldLeft / gridSize) * gridSize;
  let startY = Math.floor(worldTop / gridSize) * gridSize;
  let endX = Math.ceil(worldRight / gridSize) * gridSize;
  let endY = Math.ceil(worldBottom / gridSize) * gridSize;

  if (mapWidth != null && mapHeight != null) {
    startX = Math.max(0, startX);
    startY = Math.max(0, startY);
    endX = Math.min(mapWidth, endX);
    endY = Math.min(mapHeight, endY);
  }

  for (let x = startX; x <= endX; x += gridSize) {
    g.moveTo(x, startY);
    g.lineTo(x, endY);
  }

  for (let y = startY; y <= endY; y += gridSize) {
    g.moveTo(startX, y);
    g.lineTo(endX, y);
  }
};

const parseGridColor = (color) => {
  if (color != null) {
    if (typeof color === 'string' && color.startsWith('#')) {
      return Number.parseInt(color.slice(1), 16);
    }
    if (typeof color === 'number') {
      return color;
    }
  }
  return 0x9dc88d;
};

export default function GridLayer({
  screenWidth,
  screenHeight,
  gridSize,
  viewport,
  mapWidth,
  mapHeight,
  gridType = 'SQUARE',
  gridColor,
  gridOpacity = 1,
}) {
  const [maskObj, setMaskObj] = useState(null);

  const drawMask = useCallback((g) => {
    if (!g) return;
    g.clear();
    if (mapWidth != null && mapHeight != null) {
      g.rect(0, 0, mapWidth, mapHeight);
      g.fill(0xffffff);
    }
  }, [mapWidth, mapHeight]);

  const drawGrid = useCallback(
    (g) => {
      g.clear();

      const { x: vpX, y: vpY, scale } = viewport;

      if (!scale || scale <= 0) return;

      const cellSize = gridSize * scale;

      if (cellSize < 8) return;

      const worldLeft = -vpX / scale;
      const worldTop = -vpY / scale;
      const worldRight = (screenWidth - vpX) / scale;
      const worldBottom = (screenHeight - vpY) / scale;

      const alpha = gridOpacity * Math.min(1, Math.max(0.1, (cellSize - 8) / 80));
      const lineWidth = Math.max(0.5, 1 / scale);
      const parsedColor = parseGridColor(gridColor);

      const drawParams = {
        gridSize, worldTop, worldBottom, worldLeft, worldRight, mapWidth, mapHeight
      };

      if (gridType === 'HEXAGONAL') {
        drawHexagonalGrid(g, drawParams);
      } else {
        drawSquareGrid(g, drawParams);
      }

      g.stroke({ width: lineWidth, color: parsedColor, alpha });
    },
    [screenWidth, screenHeight, gridSize, viewport, mapWidth, mapHeight, gridType, gridColor, gridOpacity]
  );

  const hasBounds = mapWidth != null && mapHeight != null;

  return (
    <container>
      {hasBounds && <graphics draw={drawMask} ref={setMaskObj} />} {/* NOSONAR */}
      <graphics draw={drawGrid} mask={hasBounds ? maskObj : null} /> {/* NOSONAR */}
    </container>
  );
}

GridLayer.propTypes = {
  screenWidth: PropTypes.number.isRequired,
  screenHeight: PropTypes.number.isRequired,
  gridSize: PropTypes.number.isRequired,
  viewport: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    scale: PropTypes.number.isRequired,
  }).isRequired,
  mapWidth: PropTypes.number,
  mapHeight: PropTypes.number,
  gridType: PropTypes.string,
  gridColor: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  gridOpacity: PropTypes.number,
};
