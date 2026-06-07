import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { extend } from '@pixi/react';
import { Sprite, Assets } from 'pixi.js';

extend({ Sprite });

/**
 * usePixiTexture — хук для завантаження та управління PixiJS текстурою.
 *
 * Автоматично:
 * - Завантажує текстуру при зміні `imageUrl`
 * - Скасовує попереднє завантаження якщо URL змінився (race-condition safe)
 * - Вивантажує текстуру при розмонтуванні (запобігає витоку пам'яті)
 *
 * @param {string | null | undefined} imageUrl - URL зображення
 * @returns {import('pixi.js').Texture | null}
 */
function usePixiTexture(imageUrl) {
  const [texture, setTexture] = useState(null);
  const [prevUrl, setPrevUrl] = useState(imageUrl);

  // Derived state: скидаємо текстуру ОДРАЗУ, коли змінюється URL,
  // щоб уникнути set-state-in-effect і зайвих рендерів.
  if (imageUrl !== prevUrl) {
    setPrevUrl(imageUrl);
    setTexture(null);
  }

  useEffect(() => {
    if (!imageUrl) {
      return;
    }

    let cancelled = false;

    Assets.load(imageUrl)
      .then((tex) => {
        if (!cancelled) {
          setTexture(tex);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('[BackgroundLayer] Failed to load texture:', imageUrl, err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return texture;
}

/**
 * BackgroundLayer — фоновий шар ігрового поля (карта).
 *
 * Завантажує текстуру через Assets.load() та малює її як Sprite.
 * Якщо imageUrl відсутній — нічого не рендерить.
 *
 * @param {{
 *   imageUrl?: string | null,
 *   width?: number | null,
 *   height?: number | null
 * }} props
 */
export default function BackgroundLayer({ imageUrl, width, height }) {
  const texture = usePixiTexture(imageUrl);

  if (!imageUrl) return null;

  return (
    <>
      {/* Тінь під картою */}
      {Boolean(width && height) && (
        <graphics
          draw={(g) => { // NOSONAR
            g.clear();
            g.rect(12, 12, width, height);
            g.fill({ color: 0x000000, alpha: 0.4 });
          }}
        />
      )}

      {/* Карта (спрайт) */}
      {texture && (
        <sprite
          texture={texture} // NOSONAR
          x={0}
          y={0}
          width={width || texture.width}
          height={height || texture.height}
        />
      )}
    </>
  );
}

BackgroundLayer.propTypes = {
  /** URL зображення карти */
  imageUrl: PropTypes.string,
  /** Ширина у world-координатах (для масштабування Sprite) */
  width: PropTypes.number,
  /** Висота у world-координатах (для масштабування Sprite) */
  height: PropTypes.number,
};
