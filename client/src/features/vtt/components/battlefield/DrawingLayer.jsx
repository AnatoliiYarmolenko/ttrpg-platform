import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import * as PIXI from 'pixi.js';
import DraggableElement from './DraggableElement';

export default function DrawingLayer({ drawings, drawPreviews, gridSize, selectedDrawingId, setSelectedDrawingId, vttConnection, currentScene, viewport, isLocked, onContextMenu }) {
  
  // Функція для малювання однієї фігури
  const drawShape = useCallback((g, item) => {
    g.clear();
    if ((item?.points?.length ?? 0) < 2) return;

    const { type, points, color, thickness } = item;
    const hexColor = Number.parseInt(color.replace('#', ''), 16);

    const strokeOptions = { width: thickness, color: hexColor, alpha: 1 };

    if (type === 'pencil') {
      g.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) {
        g.lineTo(points[i], points[i+1]);
      }
      g.stroke(strokeOptions);
    } else if (type === 'polygon') {
      const cx = points[0];
      const cy = points[1];
      const px = points[2];
      const py = points[3];
      const r = Math.sqrt(Math.pow(px - cx, 2) + Math.pow(py - cy, 2));
      const sides = 6;
      // Start angle so the hexagon is pointy-topped (as seen in the screenshot).
      // Pointy-topped means vertices are at -90, -30, 30, 90, 150, 210 degrees.
      const angleOffset = -Math.PI / 2;
      
      for (let i = 0; i <= sides; i++) {
        const angle = angleOffset + (i * 2 * Math.PI) / sides;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke(strokeOptions);
    } else if (type === 'line') {
      g.moveTo(points[0], points[1]);
      g.lineTo(points[2], points[3]);
      g.stroke(strokeOptions);
    } else if (type === 'rect') {
      const x = Math.min(points[0], points[2]);
      const y = Math.min(points[1], points[3]);
      const w = Math.abs(points[2] - points[0]);
      const h = Math.abs(points[3] - points[1]);
      g.rect(x, y, w, h);
      g.stroke(strokeOptions);
    } else if (type === 'circle') {
      const x = points[0];
      const y = points[1];
      const r = Math.sqrt(Math.pow(points[2] - points[0], 2) + Math.pow(points[3] - points[1], 2));
      g.circle(x, y, r);
      g.stroke(strokeOptions);
    } else if (type === 'arrow') {
      g.moveTo(points[0], points[1]);
      g.lineTo(points[2], points[3]);
      // Arrowhead
      const angle = Math.atan2(points[3] - points[1], points[2] - points[0]);
      const headlen = 15 + thickness;
      g.lineTo(points[2] - headlen * Math.cos(angle - Math.PI / 6), points[3] - headlen * Math.sin(angle - Math.PI / 6));
      g.moveTo(points[2], points[3]);
      g.lineTo(points[2] - headlen * Math.cos(angle + Math.PI / 6), points[3] - headlen * Math.sin(angle + Math.PI / 6));
      g.stroke(strokeOptions);
    }
  }, []);

  return (
    <container>
      {/* Завершені малюнки (збережені на сервері) */}
      {drawings?.map((item) => {
        // Якщо це старий малюнок без x, y (намальований до оновлення), малюємо його як є
        if (item.x == null || item.y == null) {
          if (item.type === 'text') {
            return (
              <text 
                key={item.id}
                text={item.text || 'Текст'}
                x={item.points[0]}
                y={item.points[1]}
                style={new PIXI.TextStyle({
                  fontFamily: 'Arial',
                  fontSize: 24 * (item.thickness / 4),
                  fill: item.color,
                  stroke: '#000000',
                  strokeThickness: 2,
                })}
              />
            );
          }
          return <graphics key={item.id} draw={(g) => drawShape(g, item)} />;
        }

        // Новий малюнок із підтримкою DraggableElement
        return (
          <DraggableElement
            key={item.id}
            item={item}
            isSelected={selectedDrawingId === item.id}
            onSelect={() => setSelectedDrawingId(item.id)}
            onUpdate={(id, updates) => vttConnection?.sendVttSceneUpdateDrawing?.(currentScene.id, id, updates)}
            onPreview={(id, updates) => vttConnection?.sendVttSceneDrawPreview?.(currentScene.id, id, { ...item, ...updates })}
            viewport={viewport}
            gridSize={gridSize}
            isLocked={isLocked}
            onContextMenu={onContextMenu}
            renderContent={(displayWidth, displayHeight, cursor, eventHandlers) => {
              const currentScaleX = displayWidth / (item.width || 1);
              const currentScaleY = displayHeight / (item.height || 1);

              if (item.type === 'text') {
                return (
                  <text
                    text={item.text || 'Текст'}
                    x={0}
                    y={0}
                    anchor={0.5}
                    scale={{ x: currentScaleX, y: currentScaleY }}
                    eventMode="static"
                    cursor={cursor}
                    style={new PIXI.TextStyle({
                      fontFamily: 'Arial',
                      fontSize: 24 * (item.thickness / 4),
                      fill: item.color,
                      stroke: '#000000',
                      strokeThickness: 2,
                    })}
                    {...eventHandlers}
                  />
                );
              }
              return (
                <graphics
                  scale={{ x: currentScaleX, y: currentScaleY }}
                  eventMode="static"
                  cursor={cursor}
                  draw={(g) => drawShape(g, item)}
                  {...eventHandlers}
                />
              );
            }}
          />
        );
      })}

      {/* Прев'ю (те, що зараз малюють інші або я) */}
      {Object.entries(drawPreviews || {})
        .filter(([, preview]) => preview && preview.sceneId === currentScene?.id)
        .map(([key, preview]) => {
        if (preview.type === 'text') {
          return (
            <text 
              key={`preview-${key}`}
              text={preview.text || 'Текст...'}
              x={preview.points[0]}
              y={preview.points[1]}
              alpha={0.7}
              style={new PIXI.TextStyle({
                fontFamily: 'Arial',
                fontSize: 24 * (preview.thickness / 4),
                fill: preview.color,
              })}
            />
          );
        }

        return (
          <graphics
            key={`preview-${key}`}
            alpha={0.7}
            draw={(g) => drawShape(g, preview)}
          />
        );
      })}
    </container>
  );
}

DrawingLayer.propTypes = {
  drawings: PropTypes.array,
  drawPreviews: PropTypes.object,
  gridSize: PropTypes.number,
  selectedDrawingId: PropTypes.string,
  setSelectedDrawingId: PropTypes.func,
  vttConnection: PropTypes.object,
  currentScene: PropTypes.object,
  viewport: PropTypes.object,
  isLocked: PropTypes.bool,
  onContextMenu: PropTypes.func,
};
