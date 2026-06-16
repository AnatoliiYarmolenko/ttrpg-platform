import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useActiveSpeaker } from '../hooks/useActiveSpeaker';
import { MicOff, VideoOff } from 'lucide-react';

export function PeerVideoCard({ 
  audioTrack,
  videoTrack, 
  username = 'Unknown', 
  isLocal = false, 
  micEnabled = false, 
  camEnabled = false,
  className = '',
}) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (!videoRef.current) return;

    if (!videoTrack) {
      videoRef.current.srcObject = null;
      return;
    }

    const stream = new MediaStream([videoTrack]);
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(e => console.error("Video play failed:", e));
  }, [videoTrack]);

  const isSpeaking = useActiveSpeaker(audioTrack);

  return (
    <div 
      className={`
        relative w-full h-full bg-neutral-900 rounded-xl overflow-hidden shadow-lg transition-all
        ${isSpeaking && micEnabled ? 'ring-2 ring-brand-accent' : 'ring-1 ring-neutral-800'}
        ${className}
      `}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted 
        className={`w-full h-full object-cover ${camEnabled ? 'opacity-100' : 'opacity-0'}`}
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }} 
      />

      {(!camEnabled || !videoTrack) && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-800">
          <div className="w-20 h-20 rounded-full bg-neutral-700 flex items-center justify-center text-2xl font-bold text-neutral-400 shadow-inner">
            {username ? username.charAt(0).toUpperCase() : '?'}
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {!micEnabled && (
          <div className="bg-red-500/80 backdrop-blur-sm text-white p-1.5 rounded-full shadow-md" title="Мікрофон вимкнено">
            <MicOff size={14} />
          </div>
        )}
        {!camEnabled && (
          <div className="bg-red-500/80 backdrop-blur-sm text-white p-1.5 rounded-full shadow-md" title="Камера вимкнена">
            <VideoOff size={14} />
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-3 max-w-[calc(100%-24px)] flex items-center bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-md">
        <span className="truncate">{username}</span>
        {isLocal && <span className="text-neutral-400 text-xs shrink-0 ml-1.5">(Ви)</span>}
      </div>
    </div>
  );
}

PeerVideoCard.propTypes = {
  audioTrack: PropTypes.object,
  videoTrack: PropTypes.object,
  username: PropTypes.string,
  isLocal: PropTypes.bool,
  micEnabled: PropTypes.bool,
  camEnabled: PropTypes.bool,
};
