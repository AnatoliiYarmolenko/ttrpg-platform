import React from 'react';
import PropTypes from 'prop-types';
import { useCallStore } from '@/stores/useCallStore';
import { useGlobalCall } from './GlobalCallProvider';
import { useCallController } from '../hooks/useCallController';
import { useLocalMedia } from '../hooks/useLocalMedia';
import { useRemoteMedia } from '../hooks/useRemoteMedia';
import { useSessionPageQuery } from '@/features/sessions/hooks/useSessionQueries';
import { CallGrid } from './CallGrid';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/shared';
import { 
  AlertTriangle, 
  AlertCircle, 
  Video, 
  VideoOff, 
  Phone, 
  Mic, 
  MicOff, 
  LogOut, 
  PhoneOff 
} from 'lucide-react';

export function CallWidget({ sessionId }) {
  const { activeSessionId } = useCallStore();
  const numericSessionId = sessionId ? Number(sessionId) : null;
  const numericActiveSessionId = activeSessionId ? Number(activeSessionId) : null;
  const isAnotherSessionActive = numericActiveSessionId && numericActiveSessionId !== numericSessionId;

  if (isAnotherSessionActive) {
    return (
      <div className="flex flex-col h-full min-h-[280px] items-center justify-center text-center p-2">
        <div className="flex flex-col items-center justify-center flex-1 py-6">
          <div className="mb-4 text-brand-medium">
            <AlertTriangle size={44} />
          </div>
          <h3 className="text-lg font-medium text-brand-dark mb-2">Активний інший дзвінок</h3>
          <p className="text-brand-medium text-sm max-w-sm leading-relaxed">
            Ви вже берете участь у дзвінку іншої сесії. Будь ласка, завершіть його або вийдіть, щоб взаємодіяти з дзвінком на цій сторінці.
          </p>
        </div>
      </div>
    );
  }

  return <CallWidgetInner sessionId={sessionId} />;
}

function CallWidgetInner({ sessionId }) {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = React.useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = React.useState(false);

  const { data: sessionPage } = useSessionPageQuery({ sessionId });
  const actions = sessionPage?.actions || {};

  const { 
    callState, 
    connectionState, 
    presenceState,
    isStarting, 
    mediaPermissionError,
    device,
    localMicEnabled,
    localCamEnabled
  } = useCallStore();

  const { rpcClient, callConfig } = useGlobalCall() || {};
  
  const { startCall, endCall, joinCall, leaveCall } = useCallController({ rpcClient, sessionId });

  const { 
    initDevice, 
    initTransports, 
    enableMic, 
    disableMic, 
    enableCam, 
    disableCam 
  } = useLocalMedia({ rpcClient, sessionId, callConfig });

  const { consumeTrack } = useRemoteMedia({ rpcClient, sessionId });

  const isIdle = callState === 'IDLE' || callState === 'ENDED';
  const isActive = callState === 'ACTIVE';
  const isConnected = connectionState === 'CONNECTED';
  const isJoining = presenceState === 'JOINING';
  
  const isInCall = !!device && presenceState === 'JOINED';

  if (!sessionPage) return null;

  const handleStartCall = () => {
    startCall();
  };

  const handleEndCall = () => {
    endCall();
  };

  const handleJoinCall = async () => {
    if (!rpcClient || !callConfig) return;
    useCallStore.getState().joinCallSession(sessionId);
    
    try {
      const joinData = await joinCall();
      
      useCallStore.getState().setPeers((joinData.peers || []).map(peer => ({
        ...peer,
        micEnabled: peer.mediaState?.micEnabled || false,
        camEnabled: peer.mediaState?.camEnabled || false
      })));

      const currentDevice = await initDevice(joinData.routerRtpCapabilities);
      await initTransports(currentDevice);

      for (const peer of joinData.peers || []) {
        if (peer.producers) {
          for (const producer of peer.producers) {
            consumeTrack(producer.id, peer.peerId);
          }
        }
      }
      
      useCallStore.getState().setPresenceState('JOINED');
    } catch (err) {
      console.error(err);
      useCallStore.getState().setPresenceState('NOT_JOINED');
    }
  };

  const handleLeaveCall = () => {
    leaveCall();
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col h-full min-h-[280px] items-center justify-center text-center p-2">
        <div className="flex flex-col items-center justify-center flex-1 py-6">
          <div className="animate-spin w-10 h-10 border-4 border-brand-medium border-t-transparent rounded-full mb-4"></div>
          <p className="text-brand-medium text-sm font-medium animate-pulse">Підключення до сигнального сервера...</p>
        </div>
      </div>
    );
  }

  if (isIdle) {
    const isSessionActive = sessionPage?.entity?.status === 'ACTIVE';

    return (
      <div className="flex flex-col h-full min-h-[280px] items-center justify-center text-center p-2">
        <div className="flex flex-col items-center justify-center flex-1 py-6">
          <div className="mb-4 text-brand-medium">
            <VideoOff size={44} />
          </div>
          <h3 className="text-lg font-medium text-brand-dark mb-2">Дзвінок не активний</h3>
          <p className="text-brand-medium text-sm max-w-sm leading-relaxed">
            {isSessionActive 
              ? "Наразі відеодзвінок не розпочато. Тільки майстер сесії може ініціювати початок дзвінка."
              : "Розпочати відеодзвінок можна буде після того, як розпочнеться сесія."}
          </p>
        </div>
        {isSessionActive && actions.canStartCall && (
          <div className="w-full mt-auto pt-2">
            <Button 
              variant="primary" 
              onClick={handleStartCall}
              disabled={isStarting}
              fullWidth={true}
              className="w-full min-h-[43px]"
            >
              {isStarting ? 'Запуск...' : 'Розпочати дзвінок'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (isActive && !isInCall) {
    return (
      <div className="flex flex-col h-full min-h-[280px] items-center justify-center text-center p-2">
        <div className="flex flex-col items-center justify-center flex-1 py-6">
          <div className="mb-4 text-brand-medium relative flex items-center justify-center">
            <div className="absolute w-12 h-12 rounded-full border border-brand-medium animate-ping opacity-25"></div>
            <Phone size={44} />
          </div>
          <h3 className="text-lg font-medium text-brand-dark mb-2">Дзвінок триває</h3>
          <p className="text-brand-medium text-sm max-w-sm leading-relaxed">
            Майстер запрошує вас приєднатися до відеодзвінка.
          </p>
        </div>
        {(actions.canJoinCall || sessionPage?.viewer?.isParticipant || sessionPage?.viewer?.isSessionOwner) && (
          <div className="w-full mt-auto pt-2">
            <Button 
              variant="primary" 
              onClick={handleJoinCall}
              disabled={isJoining}
              fullWidth={true}
              className="w-full min-h-[43px]"
            >
              {isJoining ? 'Підключення...' : 'Приєднатися'}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 min-h-[300px]">
        {mediaPermissionError && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-4 text-sm flex items-start gap-3">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-medium mb-1">Немає доступу до камери або мікрофона</p>
              <p className="opacity-80">Будь ласка, надайте дозвіл у налаштуваннях браузера та спробуйте ще раз.</p>
              <button 
                className="mt-2 text-red-300 hover:text-red-200 underline text-xs"
                onClick={() => {
                  if (!localMicEnabled) enableMic();
                  if (!localCamEnabled) enableCam();
                }}
              >
                Спробувати знову
              </button>
            </div>
          </div>
        )}
        <CallGrid />
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button 
            variant={localMicEnabled ? "secondary" : "danger"} 
            size="sm"
            onClick={localMicEnabled ? disableMic : enableMic}
            className="w-10 h-10 flex items-center justify-center p-0 rounded-lg"
            title={localMicEnabled ? "Вимкнути мікрофон" : "Увімкнути мікрофон"}
          >
            {localMicEnabled ? <Mic size={18} /> : <MicOff size={18} />}
          </Button>
          <Button 
            variant={localCamEnabled ? "secondary" : "danger"} 
            size="sm"
            onClick={localCamEnabled ? disableCam : enableCam}
            className="w-10 h-10 flex items-center justify-center p-0 rounded-lg"
            title={localCamEnabled ? "Вимкнути камеру" : "Увімкнути камеру"}
          >
            {localCamEnabled ? <Video size={18} /> : <VideoOff size={18} />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {actions.canEndCall && (
            <Button 
              variant="danger" 
              size="sm" 
              onClick={() => setIsEndModalOpen(true)}
              className="w-10 h-10 flex items-center justify-center p-0 rounded-lg"
              title="Завершити для всіх"
            >
              <PhoneOff size={18} />
            </Button>
          )}
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => setIsLeaveModalOpen(true)}
            className="w-10 h-10 flex items-center justify-center p-0 rounded-lg"
            title="Покинути дзвінок"
          >
            <LogOut size={18} />
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="Покинути дзвінок?"
        message="Ви дійсно бажаєте вийти з цього відеодзвінка? Ви зможете приєднатися знову в будь-який момент."
        confirmText="Покинути"
        cancelText="Скасувати"
        variant="danger"
        onConfirm={() => {
          handleLeaveCall();
          setIsLeaveModalOpen(false);
        }}
        onCancel={() => setIsLeaveModalOpen(false)}
      />

      <ConfirmModal
        isOpen={isEndModalOpen}
        title="Завершити дзвінок?"
        message="Ви дійсно бажаєте завершити цей відеодзвінок для всіх учасників?"
        confirmText="Завершити"
        cancelText="Скасувати"
        variant="danger"
        onConfirm={() => {
          handleEndCall();
          setIsEndModalOpen(false);
        }}
        onCancel={() => setIsEndModalOpen(false)}
      />
    </div>
  );
}

CallWidget.propTypes = {
  sessionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

CallWidgetInner.propTypes = {
  sessionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
