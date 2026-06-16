import React from 'react';
import { useCallStore } from '@/stores/useCallStore';
import useAuthStore from '@/stores/useAuthStore';
import { PeerVideoCard } from './PeerVideoCard';

const GAP = 8; 
const ASPECT_RATIO = 16 / 9;
const MIN_TILE_WIDTH = 200;

/**
 * Підбирає кількість колонок/рядків так, щоб площа кожної плитки була
 * максимальною за заданого співвідношення сторін. Працює як для широкого,
 * так і для вузького/високого контейнера та масштабується на будь-яке N.
 */
function computeBestLayout(width, height, count, ratio = ASPECT_RATIO, gap = GAP) {
  if (count === 0 || width <= 0 || height <= 0) {
    return { cols: 1, rows: 1, tileWidth: 0, tileHeight: 0 };
  }

  let best = { area: 0, cols: 1, rows: 1, tileWidth: 0, tileHeight: 0 };

  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);

    const availWidth = width - gap * (cols - 1);
    const availHeight = height - gap * (rows - 1);
    if (availWidth <= 0 || availHeight <= 0) continue;

    const cellWidth = availWidth / cols;
    const cellHeight = availHeight / rows;

    let tileWidth = cellWidth;
    let tileHeight = tileWidth / ratio;
    if (tileHeight > cellHeight) {
      tileHeight = cellHeight;
      tileWidth = tileHeight * ratio;
    }

    const area = tileWidth * tileHeight;
    if (area > best.area) {
      best = { area, cols, rows, tileWidth, tileHeight };
    }
  }

  return best;
}

/**
 * Розкладка зі скролом: фіксуємо кількість колонок за шириною контейнера й
 * мінімальним розміром плитки, плитки зберігають співвідношення сторін, а
 * по вертикалі контейнер прокручується.
 */
function computeScrollLayout(width, ratio = ASPECT_RATIO, gap = GAP, minWidth = MIN_TILE_WIDTH) {
  const cols = Math.max(1, Math.floor((width + gap) / (minWidth + gap)));
  const tileWidth = (width - gap * (cols - 1)) / cols;
  const tileHeight = tileWidth / ratio;
  return { cols, tileWidth, tileHeight };
}

export function CallGrid() {
  const { user } = useAuthStore();
  const {
    peers,
    consumers,
    micProducer,
    camProducer,
    localMicEnabled,
    localCamEnabled,
    myPeerId
  } = useCallStore();

  const containerRef = React.useRef(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const activePeers = peers.filter(peer => peer.peerId !== myPeerId);

  const items = [
    {
      id: 'local',
      audioTrack: micProducer?.track,
      videoTrack: camProducer?.track,
      username: user?.displayName || user?.username || 'Ви',
      isLocal: true,
      micEnabled: localMicEnabled,
      camEnabled: localCamEnabled,
    },
    ...activePeers.map(peer => {
      const peerConsumers = Array.from(consumers.values()).filter(c => String(c.appData?.peerId) === String(peer.peerId));
      const audioConsumer = peerConsumers.find(c => c.kind === 'audio');
      const videoConsumer = peerConsumers.find(c => c.kind === 'video');
      return {
        id: peer.peerId,
        audioTrack: audioConsumer?.track,
        videoTrack: videoConsumer?.track,
        username: peer.displayName || peer.username || 'Невідомий',
        isLocal: false,
        micEnabled: peer.micEnabled,
        camEnabled: peer.camEnabled,
      };
    })
  ];

  const fit = computeBestLayout(size.width, size.height, items.length);

  const needsScroll = fit.tileWidth > 0 && fit.tileWidth < MIN_TILE_WIDTH;
  const layout = needsScroll ? computeScrollLayout(size.width) : fit;

  return (
    <div ref={containerRef} className="w-full h-full p-1">
      <div
        className={`flex flex-wrap justify-center w-full h-full ${
          needsScroll
            ? 'items-start content-start overflow-y-auto'
            : 'items-center content-center overflow-hidden'
        }`}
        style={{ gap: `${GAP}px` }}
      >
        {layout.tileWidth > 0 && items.map(item => (
          <div
            key={item.id}
            style={{ width: layout.tileWidth, height: layout.tileHeight }}
          >
            <PeerVideoCard {...item} />
          </div>
        ))}
      </div>
    </div>
  );
}
