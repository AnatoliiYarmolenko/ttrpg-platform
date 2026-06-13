import React from 'react';
import * as PIXI from 'pixi.js';
import PropTypes from 'prop-types';

export default function RulerLayer({ localRuler, remoteRulers, gridSize, gridScale, gridType = 'SQUARE' }) {
  const rulers = [];
  if (localRuler) rulers.push({ ...localRuler, _key: 'local' });
  Object.entries(remoteRulers || {}).forEach(([userId, r]) => {
    if (r) rulers.push({ ...r, _key: userId });
  });

  if (rulers.length === 0) return null;

  return (
    <>
      {rulers.map((ruler) => (
        <RulerShape 
          key={ruler._key} 
          ruler={ruler} 
          gridSize={gridSize} 
          gridScale={gridScale} 
          gridType={gridType}
        />
      ))}
    </>
  );
}

function axialToCubeRound(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);
  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);
  if (x_diff > y_diff && x_diff > z_diff) rx = -ry - rz;
  else if (y_diff > z_diff) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

function pixelToHexCube(x, y, R) {
  // Pointy-topped hex conversion
  // Since our grid odd-r is offset by 0.5 * colWidth, we need to adjust the center.
  // Actually, GridLayer uses simple center calculations: cx = c*colWidth + (r%2 ? colWidth/2 : 0)
  // Which maps directly to pointy-topped hexes where x = sqrt(3)*R*q + sqrt(3)/2*R*r, y = 3/2*R*r
  // So standard axial conversion works:
  const q = (Math.sqrt(3)/3 * x - 1/3 * y) / R;
  const r = (2/3 * y) / R;
  return axialToCubeRound(q, r);
}

function RulerShape({ ruler, gridSize, gridScale, gridType }) {
  const { type, startX, startY, endX, endY, config } = ruler;
  
  let cells = 0;

  if (gridType === 'HEXAGONAL') {
    const R = gridSize / 2;
    const startCube = pixelToHexCube(startX, startY, R);
    const endCube = pixelToHexCube(endX, endY, R);
    cells = Math.max(
      Math.abs(startCube.x - endCube.x),
      Math.abs(startCube.y - endCube.y),
      Math.abs(startCube.z - endCube.z)
    );
  } else {
    // SQUARE
    const startCol = Math.floor(startX / gridSize);
    const startRow = Math.floor(startY / gridSize);
    const endCol = Math.floor(endX / gridSize);
    const endRow = Math.floor(endY / gridSize);
    cells = Math.max(Math.abs(endCol - startCol), Math.abs(endRow - startRow));
  }

  // Справжні дельти для плавного малювання
  const rawDx = endX - startX;
  const rawDy = endY - startY;
  
  const feet = cells * gridScale;
  const rawAngle = Math.atan2(rawDy, rawDx); // radians

  const drawShape = React.useCallback((g) => {
    g.clear();
    
    // Ruler colors
    const fillColor = 0xa3e635; // Light green (Tailwind lime-400)
    const fillAlpha = 0.4;
    const lineColor = 0x65a30d; // Tailwind lime-600

    if (type === 'line') {
      g.moveTo(startX, startY);
      g.lineTo(endX, endY);
      g.stroke({ color: lineColor, width: 4, alpha: 0.8 });
      
      // Arrow head
      if (Math.hypot(rawDx, rawDy) > 10) {
        g.moveTo(endX, endY);
        g.lineTo(endX - 15 * Math.cos(rawAngle - Math.PI / 6), endY - 15 * Math.sin(rawAngle - Math.PI / 6));
        g.moveTo(endX, endY);
        g.lineTo(endX - 15 * Math.cos(rawAngle + Math.PI / 6), endY - 15 * Math.sin(rawAngle + Math.PI / 6));
        g.stroke({ color: lineColor, width: 4, alpha: 0.8 });
      }
    } 
    else if (type === 'cone') {
      const radiusPx = (config.distance / gridScale) * gridSize;
      const angleRad = (config.coneAngle * Math.PI) / 180;
      
      g.moveTo(startX, startY);
      g.arc(startX, startY, radiusPx, rawAngle - angleRad / 2, rawAngle + angleRad / 2);
      g.lineTo(startX, startY);
      g.fill({ color: fillColor, alpha: fillAlpha });
      g.stroke({ color: lineColor, width: 2, alpha: 0.8 });
    }
    else if (type === 'circle') {
      const radiusPx = (config.radius / gridScale) * gridSize;
      
      // Draw circle at the cursor position
      g.circle(endX, endY, radiusPx);
      g.fill({ color: fillColor, alpha: fillAlpha });
      g.stroke({ color: lineColor, width: 2, alpha: 0.8 });
    }
    else if (type === 'rectangle') {
      const widthPx = (config.width / gridScale) * gridSize;
      const heightPx = (config.height / gridScale) * gridSize;
      
      // Draw rect centered on cursor
      g.rect(endX - widthPx / 2, endY - heightPx / 2, widthPx, heightPx);
      g.fill({ color: fillColor, alpha: fillAlpha });
      g.stroke({ color: lineColor, width: 2, alpha: 0.8 });
    }
  }, [type, startX, startY, endX, endY, rawDx, rawDy, rawAngle, config, gridSize, gridScale]);

  // Where to place the text label
  let textX = endX;
  let textY = endY;
  let textContent = `${feet} ft`;

  if (type === 'cone') {
    textContent = `${config.distance} ft (Кут ${config.coneAngle}°)`;
  } else if (type === 'circle') {
    textContent = `R: ${config.radius} ft`;
    textY = endY - ((config.radius / gridScale) * gridSize) - 15;
  } else if (type === 'rectangle') {
    textContent = `${config.width}x${config.height} ft`;
    textY = endY - ((config.height / gridScale) * gridSize) / 2 - 15;
  }

  // Offset text slightly ahead of the cursor to prevent overlap
  if (type === 'line' || type === 'cone') {
    textX += 40 * Math.cos(rawAngle);
    textY += 40 * Math.sin(rawAngle);
  }

  return (
    <>
      <graphics draw={drawShape} // nosonar
      />
      {Math.hypot(rawDx, rawDy) > 5 || type !== 'line' ? (
        <text
          text={textContent} // nosonar
          x={textX}
          y={textY}
          anchor={0.5} // nosonar
          style={new PIXI.TextStyle({
            fontFamily: 'Inter, sans-serif',
            fontSize: 16,
            fill: 0xffffff,
            stroke: { color: 0x000000, width: 3, join: 'round' },
            fontWeight: 'bold',
          })}
        />
      ) : null}
    </>
  );
}

RulerLayer.propTypes = {
  localRuler: PropTypes.object,
  remoteRulers: PropTypes.object,
  gridSize: PropTypes.number.isRequired,
  gridScale: PropTypes.number.isRequired,
  gridType: PropTypes.string
};

RulerShape.propTypes = {
  ruler: PropTypes.shape({
    type: PropTypes.string.isRequired,
    startX: PropTypes.number.isRequired,
    startY: PropTypes.number.isRequired,
    endX: PropTypes.number.isRequired,
    endY: PropTypes.number.isRequired,
    config: PropTypes.shape({
      distance: PropTypes.number,
      coneAngle: PropTypes.number,
      radius: PropTypes.number,
      width: PropTypes.number,
      height: PropTypes.number
    }).isRequired
  }).isRequired,
  gridSize: PropTypes.number.isRequired,
  gridScale: PropTypes.number.isRequired,
  gridType: PropTypes.string
};
