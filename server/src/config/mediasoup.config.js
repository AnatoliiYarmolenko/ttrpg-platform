const {
  mediasoupListenIp,
  mediasoupAnnouncedIp,
  mediasoupMinPort,
  mediasoupMaxPort,
} = require('./config');

/**
 * Конфігурація mediasoup
 *
 * Всі значення читаються з centralізованого config.js,
 * який у свою чергу читає env-змінні.
 *
 * Документація mediasoup:
 * https://mediasoup.org/documentation/v3/mediasoup/api/
 */

/**
 * Налаштування mediasoup Worker
 * Worker — це окремий процес C++, який виконує всю медіа-обробку.
 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
 */
const workerSettings = {
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  logTags: [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp',
    'rtcp',
  ],
  rtcMinPort: mediasoupMinPort,
  rtcMaxPort: mediasoupMaxPort,
};

/**
 * Налаштування mediasoup Router
 * Router визначає підтримувані медіа-кодеки для кімнати.
 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
 */
const routerOptions = {
  mediaCodecs: [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
      parameters: {
        usedtx: 1,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP9',
      clockRate: 90000,
      parameters: {
        'profile-id': 2,
        'x-google-start-bitrate': 1000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/h264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1000,
      },
    },
  ],
};

/**
 * Налаштування WebRTC Transport (send і recv)
 * Визначають, на яких IP/портах mediasoup приймає ICE/DTLS з'єднання.
 * @see https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
 */
const webRtcTransportOptions = {
  listenInfos: [
    {
      protocol: 'udp',
      ip: mediasoupListenIp,
      announcedAddress:mediasoupAnnouncedIp,
    },
    {
      protocol: 'tcp',
      ip: mediasoupListenIp,
      announcedAddress:mediasoupAnnouncedIp,

    },
  ],
  initialAvailableOutgoingBitrate: 1_000_000,
  maximumIncomingBitrate: 1_500_000,
  enableSctp: false,
};

module.exports = {
  workerSettings,
  routerOptions,
  webRtcTransportOptions,
};
