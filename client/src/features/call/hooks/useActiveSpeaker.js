import { useState, useEffect, useRef } from 'react';

/**
 * Хук для визначення, чи є у медіапотоці активне аудіо (мовлення)
 * Використовує Web Audio API для аналізу рівнів звуку.
 * 
 * @param {MediaStream} mediaStream - Медіапотік для аналізу
 * @param {Object} options - Параметри конфігурації
 * @param {number} options.threshold - Порогове значення гучності (0.0 до 1.0)
 * @param {number} options.interval - Інтервал перевірки в мс
 */

export function useActiveSpeaker(audioTrack, { threshold = 0.05, interval = 100 } = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const intervalIdRef = useRef(null);

  useEffect(() => {
    if (!audioTrack) {
      const timeoutId = setTimeout(() => setIsSpeaking(false), 0);
      return () => clearTimeout(timeoutId);
    }

    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return;

    try {
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const analysisStream = new MediaStream([audioTrack.clone()]);
      const source = audioCtx.createMediaStreamSource(analysisStream);
      source.connect(analyser);
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (const value of dataArray) {
          sum += value * value;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalizedVolume = rms / 255;

        if (normalizedVolume > threshold) {
          setIsSpeaking(true);
        } else {
          setIsSpeaking(false);
        }
      };

      intervalIdRef.current = setInterval(checkVolume, interval);

    } catch (err) {
      console.error('Failed to initialize active speaker detection', err);
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, [audioTrack, threshold, interval]);

  return audioTrack ? isSpeaking : false;
}
