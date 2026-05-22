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
  // Рівень логування mediasoup worker
  // 'warn' у production, 'debug' для діагностики
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  // Теги логування (які категорії виводити)
  logTags: [
    'info',
    'ice',
    'dtls',
    'rtp',
    'srtp',
    'rtcp',
  ],
  // Діапазон UDP/TCP портів для RTC транспортів
  // Ці порти повинні бути відкриті на firewall/DigitalOcean
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
    // ===== Аудіо =====
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
      parameters: {
        // Дозволяємо DTX (Discontinuous Transmission) для зменшення трафіку в паузах
        usedtx: 1,
      },
    },
    // ===== Відео =====
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        // start-bitrate рекомендований для стабільного початку
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
        // Baseline profile — максимальна сумісність браузерів
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
      // announcedAddress оголошується клієнтам у ICE candidates
      // У production це зовнішній IP сервера (MEDIASOUP_ANNOUNCED_IP)
      announcedAddress: mediasoupAnnouncedIp !== '127.0.0.1' ? mediasoupAnnouncedIp : undefined,
    },
    {
      protocol: 'tcp',
      ip: mediasoupListenIp,
      announcedAddress: mediasoupAnnouncedIp !== '127.0.0.1' ? mediasoupAnnouncedIp : undefined,
    },
  ],
  // Початкові обмеження бітрейту (auto-adjusts через REMB/TWCC)
  initialAvailableOutgoingBitrate: 1_000_000, // 1 Mbps
  // Максимальна вхідна бітрейт per transport
  maximumIncomingBitrate: 1_500_000, // 1.5 Mbps
  // Увімкнути SCTP (DataChannel) — не потрібно для MVP, але не шкодить
  enableSctp: false,
};

module.exports = {
  workerSettings,
  routerOptions,
  webRtcTransportOptions,
};
