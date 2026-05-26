import { useCallback } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { useCallStore } from '@/stores/useCallStore';
import { toast } from '@/stores/useToastStore';

export function useLocalMedia({ rpcClient, sessionId, callConfig }) {
  const { 
    setDevice,
    setTransports,
    setMicProducer,
    setCamProducer,
    setMediaPermissionError,
  } = useCallStore();

  // Ініціалізуємо mediasoup device
  const initDevice = useCallback(async (routerRtpCapabilities) => {
    try {
      const newDevice = new mediasoupClient.Device();
      await newDevice.load({ routerRtpCapabilities });
      setDevice(newDevice);
      return newDevice;
    } catch (err) {
      console.error('Failed to init mediasoup device', err);
      toast.error('Не вдалося ініціалізувати аудіо/відео пристрій. Перевірте підтримку вашого браузера.');
      throw err;
    }
  }, [setDevice]);

  // Створюємо транспорти
  const initTransports = useCallback(async (currentDevice) => {
    try {
      // 1. Створюємо Send Transport
      const sendTransportParams = await rpcClient.request('call:createWebRtcTransport', { 
        sessionId, 
        producing: true, 
        consuming: false 
      });

      const sendTrans = currentDevice.createSendTransport({
        ...sendTransportParams,
        iceServers: callConfig?.iceServers || []
      });

      sendTrans.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await rpcClient.request('call:connectWebRtcTransport', {
            sessionId,
            transportId: sendTrans.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTrans.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
        try {
          const { id } = await rpcClient.request('call:produce', {
            sessionId,
            transportId: sendTrans.id,
            kind,
            rtpParameters,
            appData
          });
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // 2. Створюємо Recv Transport
      const recvTransportParams = await rpcClient.request('call:createWebRtcTransport', { 
        sessionId, 
        producing: false, 
        consuming: true 
      });

      const recvTrans = currentDevice.createRecvTransport({
        ...recvTransportParams,
        iceServers: callConfig?.iceServers || []
      });

      recvTrans.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await rpcClient.request('call:connectWebRtcTransport', {
            sessionId,
            transportId: recvTrans.id,
            dtlsParameters
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      setTransports({ sendTransport: sendTrans, recvTransport: recvTrans });
      return { sendTransport: sendTrans, recvTransport: recvTrans };
    } catch (err) {
      console.error('Failed to init transports', err);
      toast.error('Помилка підключення до медіа-сервера');
      throw err;
    }
  }, [rpcClient, sessionId, callConfig, setTransports]);

  // Вимикаємо мікрофон
  const disableMic = useCallback(() => {
    const { micProducer } = useCallStore.getState();
    if (micProducer) {
      micProducer.track.stop();
      micProducer.close();
      rpcClient.request('call:closeProducer', { sessionId, producerId: micProducer.id }).catch(console.error);
      setMicProducer(null);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { micEnabled: false } });
    }
  }, [rpcClient, sessionId, setMicProducer]);

  // Запитуємо user media та створюємо producer-и
  const enableMic = useCallback(async () => {
    const { device, sendTransport, micProducer } = useCallStore.getState();
    if (!device || !sendTransport) return;
    if (micProducer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = stream.getAudioTracks()[0];
      
      const producer = await sendTransport.produce({ 
        track, 
        codecOptions: {
          opusStereo: true,
          opusDtx: true
        }
      });
      
      setMicProducer(producer);
      
      producer.on('trackended', () => {
        disableMic();
      });
      producer.on('transportclose', () => {
        setMicProducer(null);
      });
      
      setMediaPermissionError(false);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { micEnabled: true } });

    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setMediaPermissionError(true);
        toast.error('Доступ до мікрофона заборонено браузером');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        toast.error('Мікрофон вже використовується іншим додатком або вкладкою');
        console.warn('Microphone in use:', err);
      } else {
        toast.error('Не вдалося увімкнути мікрофон');
        console.error(err);
      }
    }
  }, [setMicProducer, setMediaPermissionError, disableMic, rpcClient, sessionId]);

  // (disableMic defined above)

  const disableCam = useCallback(() => {
    const { camProducer } = useCallStore.getState();
    if (camProducer) {
      camProducer.track.stop();
      camProducer.close();
      rpcClient.request('call:closeProducer', { sessionId, producerId: camProducer.id }).catch(console.error);
      setCamProducer(null);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { camEnabled: false } });
    }
  }, [rpcClient, sessionId, setCamProducer]);

  const enableCam = useCallback(async () => {
    const { device, sendTransport, camProducer } = useCallStore.getState();
    if (!device || !sendTransport) return;
    if (camProducer) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 360 },
          frameRate: { ideal: 15, max: 24 }
        } 
      });
      const track = stream.getVideoTracks()[0];
      const producer = await sendTransport.produce({ track });
      setCamProducer(producer);

      producer.on('trackended', () => {
        disableCam();
      });
      producer.on('transportclose', () => {
        setCamProducer(null);
      });

      setMediaPermissionError(false);
      rpcClient.sendEvent('call:setMediaState', { sessionId, mediaState: { camEnabled: true } });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setMediaPermissionError(true);
        toast.error('Доступ до камери заборонено браузером');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        toast.error('Камера вже використовується іншим додатком або вкладкою');
        console.warn('Camera in use:', err);
      } else {
        toast.error('Не вдалося увімкнути камеру');
        console.error(err);
      }
    }
  }, [setCamProducer, rpcClient, sessionId, setMediaPermissionError, disableCam]);

  return {
    initDevice,
    initTransports,
    enableMic,
    disableMic,
    enableCam,
    disableCam,
  };
}
