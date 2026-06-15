import React, { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { extend } from '@pixi/react';
import { Graphics, Container, Sprite, Assets } from 'pixi.js';
import { resolveMediaUrl } from '@/lib/resolveMediaUrl';
import DraggableElement from './DraggableElement';
import useAuthStore from '@/stores/useAuthStore';

extend({ Graphics, Container, Sprite });

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
    let isMounted = true;
    if (resolvedUrl) {
      Assets.load(resolvedUrl).then((t) => {
        if (isMounted) setState({ url: resolvedUrl, texture: t });
      }).catch(err => {
        console.error('Failed to load token texture:', err);
      });
    }
    return () => { isMounted = false; };
  }, [resolvedUrl]);

  return state.texture;
}

export default function TokenLayer({ tokens, gridSize, onTokenDrag, onTokenDrop, viewport, isLocked = false, onContextMenu, onDoubleClick, selectedTokenId, onSelectToken, onUpdateToken, isGM }) {
  const currentUser = useAuthStore((s) => s.user);
  const viewerId = currentUser?.id;

  return (
    <container>
      {tokens.map((token) => {
        const isMyToken = (token.ownerId && token.ownerId === viewerId) || (token.id === `token-player-${viewerId}`);
        const tokenLocked = isLocked || (!isGM && !isMyToken);

        return (
          <Token
            key={token.id}
            token={token}
            gridSize={gridSize}
            onDrag={onTokenDrag}
            onDrop={onTokenDrop}
            viewport={viewport}
            isLocked={tokenLocked}
            onContextMenu={onContextMenu}
            onDoubleClick={onDoubleClick}
            selectedTokenId={selectedTokenId}
            onSelectToken={onSelectToken}
            onUpdateToken={onUpdateToken}
            isGM={isGM}
            isMyToken={isMyToken}
          />
        );
      })}
    </container>
  );
}

TokenLayer.propTypes = {
  tokens: PropTypes.array.isRequired,
  gridSize: PropTypes.number.isRequired,
  onTokenDrag: PropTypes.func,
  onTokenDrop: PropTypes.func,
  viewport: PropTypes.object.isRequired,
  isLocked: PropTypes.bool,
  onContextMenu: PropTypes.func,
  onDoubleClick: PropTypes.func,
  selectedTokenId: PropTypes.string,
  onSelectToken: PropTypes.func,
  onUpdateToken: PropTypes.func,
  isGM: PropTypes.bool,
};

function Token({ token, gridSize, onDrag, onDrop, viewport, isLocked, onContextMenu, onDoubleClick, selectedTokenId, onSelectToken, onUpdateToken, isGM, isMyToken }) {
  const texture = usePixiTexture(token.avatarUrl);
  
  // Create an item object that DraggableElement expects
  const item = useMemo(() => ({
    id: token.id,
    type: 'token',
    url: token.avatarUrl,
    x: token.x,
    y: token.y,
    width: gridSize * (token.size || 1),
    height: gridSize * (token.size || 1),
    scaleX: token.scaleX ?? 1,
    scaleY: token.scaleY ?? 1,
    rotation: token.rotation ?? 0
  }), [token, gridSize]);

  const maskRef = useRef(null);
  const [maskObj, setMaskObj] = useState(null);

  useEffect(() => {
    if (maskRef.current && texture) {
      setMaskObj(maskRef.current);
    }
  }, [texture, item.width, item.height, item.scaleX, item.scaleY]);

  const drawTokenContent = useCallback(
    (g, tokenRadius) => {
      g.clear();
      // Тінь
      g.circle(2, 2, tokenRadius);
      g.fill({ color: 0x000000, alpha: 0.3 });
      
      // Фон, якщо текстура ще не завантажилась або її немає
      if (!texture) {
        g.circle(0, 0, tokenRadius);
        g.fill({ color: token.color || (token.isAlly ? 0x27ae60 : 0xe74c3c) });
      }
    },
    [texture, token.isAlly, token.color]
  );

  const drawTokenStroke = useCallback(
    (g, tokenRadius) => {
      g.clear();
      g.circle(0, 0, tokenRadius);
      g.stroke({ width: 3, color: token.color || (token.isAlly ? 0x2ecc71 : 0xe74c3c), alpha: 0.9 });
      
      // Смужка здоров'я
      const canSeeHp = isGM || isMyToken || (!token.isGmCreature && token.isAlly);
      if (token.hpMax > 0 && canSeeHp) {
        const hpPercent = Math.max(0, Math.min(1, token.hpCurrent / token.hpMax));
        const barWidth = tokenRadius * 1.5;
        const barHeight = 4;
        const barY = tokenRadius + 4;
        
        g.rect(-barWidth/2, barY, barWidth, barHeight);
        g.fill({ color: 0x000000, alpha: 0.7 });
        
        g.rect(-barWidth/2, barY, barWidth * hpPercent, barHeight);
        let barColor = 0xe74c3c;
        if (hpPercent > 0.5) {
          barColor = 0x2ecc71;
        } else if (hpPercent > 0.2) {
          barColor = 0xf1c40f;
        }
        g.fill({ color: barColor });
      }
    },
    [token.isAlly, token.hpCurrent, token.hpMax, token.isGmCreature, token.color, isGM, isMyToken]
  );

  const drawTokenMask = useCallback(
    (g, tokenRadius) => {
      g.clear();
      g.circle(0, 0, tokenRadius);
      g.fill({ color: 0xffffff });
    },
    []
  );

  return (
    <DraggableElement
      item={item}
      isSelected={selectedTokenId === token.id}
      onSelect={() => onSelectToken?.(token.id)}
      onUpdate={(id, updates) => {
        if (onUpdateToken) onUpdateToken(id, updates);
        if (updates.x !== undefined && updates.y !== undefined) {
          if (onDrop) onDrop(id, updates.x, updates.y);
        }
      }}
      onPreview={(id, updates) => {
        if (updates.x !== undefined && updates.y !== undefined) {
          if (onDrag) onDrag(id, updates.x, updates.y);
        }
      }}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      viewport={viewport}
      gridSize={gridSize}
      isLocked={isLocked}
      renderContent={(displayWidth, displayHeight, cursor, eventHandlers) => {
        // Use the smaller dimension as the token diameter to keep it circular even if scaled non-uniformly
        const effectiveSize = Math.min(displayWidth, displayHeight);
        const tokenRadius = effectiveSize * 0.45; // slightly smaller to leave a gap

        return (
          <container
            eventMode={isLocked ? "none" : "static"} /* NOSONAR */
            cursor={cursor}
            {...eventHandlers}
          >
            <graphics draw={(g) => drawTokenContent(g, tokenRadius) /* NOSONAR */} />
            
            {texture && (
              <container mask={maskObj /* NOSONAR */}>
                <graphics ref={maskRef} draw={(g) => drawTokenMask(g, tokenRadius) /* NOSONAR */} />
                <sprite 
                  texture={texture /* NOSONAR */} 
                  anchor={0.5 /* NOSONAR */} 
                  width={tokenRadius * 2} 
                  height={tokenRadius * 2} 
                />
              </container>
            )}

            <graphics draw={(g) => drawTokenStroke(g, tokenRadius) /* NOSONAR */} />
          </container>
        );
      }}
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
    avatarUrl: PropTypes.string,
    scaleX: PropTypes.number,
    scaleY: PropTypes.number,
    rotation: PropTypes.number,
    isAlly: PropTypes.bool,
    isGmCreature: PropTypes.bool,
    hpMax: PropTypes.number,
    hpCurrent: PropTypes.number,
  }).isRequired,
  gridSize: PropTypes.number.isRequired,
  onDrag: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
  viewport: PropTypes.shape({
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    scale: PropTypes.number.isRequired,
  }).isRequired,
  isLocked: PropTypes.bool,
  onContextMenu: PropTypes.func,
  onDoubleClick: PropTypes.func,
  selectedTokenId: PropTypes.string,
  onSelectToken: PropTypes.func,
  onUpdateToken: PropTypes.func,
  isGM: PropTypes.bool,
  isMyToken: PropTypes.bool,
};
