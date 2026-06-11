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
      <div className="w-full h-full p-1">
        <PeerVideoCard {...items[0]} />
      </div>
    );
  }

  if (total === 2) {
    return (
      <div className="grid grid-rows-2 gap-2 w-full h-full p-1">
        <PeerVideoCard {...items[0]} />
        <PeerVideoCard {...items[1]} />
      </div>
    );
  }

  if (total === 3) {
    return (
      <div className="grid grid-rows-2 grid-cols-2 gap-2 w-full h-full p-1">
        <div className="col-span-2 row-span-1 h-full">
          <PeerVideoCard {...items[0]} />
        </div>
        <div className="col-span-1 row-span-1 h-full">
          <PeerVideoCard {...items[1]} />
        </div>
        <div className="col-span-1 row-span-1 h-full">
          <PeerVideoCard {...items[2]} />
        </div>
      </div>
    );
  }

  if (total === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-2 w-full h-full p-1">
        {items.map(item => (
          <div key={item.id} className="w-full h-full">
            <PeerVideoCard {...item} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 w-full h-full auto-rows-fr p-1 overflow-y-auto">
      {items.map(item => (
        <div key={item.id} className="w-full h-full min-h-[150px]">
          <PeerVideoCard {...item} />
        </div>
      ))}
    </div>
  );
}
