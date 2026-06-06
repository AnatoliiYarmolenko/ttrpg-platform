import React from 'react';
import { useCallStore } from '@/stores/useCallStore';
import useAuthStore from '@/stores/useAuthStore';
import { PeerVideoCard } from './PeerVideoCard';

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

  const total = items.length;

  if (total === 1) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[300px]">
        <div className="w-full max-w-2xl aspect-video">
          <PeerVideoCard {...items[0]} />
        </div>
      </div>
    );
  }

  if (total === 2) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center w-full">
        {items.map(item => (
          <div key={item.id} className="w-full aspect-video">
            <PeerVideoCard {...item} />
          </div>
        ))}
      </div>
    );
  }

  if (total === 3) {
    return (
      <div className="grid grid-cols-12 gap-4 w-full items-center justify-center">
        {items.slice(0, 2).map(item => (
          <div key={item.id} className="col-span-12 md:col-span-6 w-full aspect-video">
            <PeerVideoCard {...item} />
          </div>
        ))}
        <div className="col-span-12 md:col-span-6 md:col-start-4 w-full aspect-video">
          <PeerVideoCard {...items[2]} />
        </div>
      </div>
    );
  }

  if (total === 4) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {items.map(item => (
          <div key={item.id} className="w-full aspect-video">
            <PeerVideoCard {...item} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
      {items.map(item => (
        <div key={item.id} className="w-full aspect-video">
          <PeerVideoCard {...item} />
        </div>
      ))}
    </div>
  );
}
