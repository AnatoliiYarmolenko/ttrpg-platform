import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useCallStore } from '@/stores/useCallStore';

function AudioTag({ track, isLocal }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl || !track) return;
    
    const stream = new MediaStream([track]);
    audioEl.srcObject = stream;
    
    audioEl.play().catch(e => console.error("Audio play failed in GlobalAudioRenderer:", e));
    
    return () => {
      if (audioEl) {
        audioEl.srcObject = null;
      }
    };
  }, [track]);

  /* eslint-disable-next-line jsx-a11y/media-has-caption */
  return <audio ref={audioRef} autoPlay muted={isLocal} className="hidden" style={{ display: 'none' }} />;
}

AudioTag.propTypes = {
  track: PropTypes.shape({}).isRequired,
  isLocal: PropTypes.bool,
};

export function GlobalAudioRenderer() {
  const consumers = useCallStore(state => state.consumers);
  
  // Фільтруємо лише аудіо консьюмери
  const audioConsumers = Array.from(consumers.values()).filter(c => c.kind === 'audio');

  if (audioConsumers.length === 0) return null;

  return (
    <div id="global-audio-renderer" style={{ display: 'none' }}>
      {audioConsumers.map(consumer => (
        <AudioTag key={consumer.id} track={consumer.track} isLocal={false} />
      ))}
    </div>
  );
}
