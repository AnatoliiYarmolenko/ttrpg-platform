import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CallWidget } from '@/features/call/components/CallWidget';

vi.mock('@/features/call/components/CallGrid', () => ({
  CallGrid: () => <div data-testid="mock-call-grid">Call Grid</div>
}));
vi.mock('@/components/shared', () => {
  const PropTypes = require('prop-types');
  const ConfirmModal = ({ isOpen, title, onConfirm, onCancel }) => (
    isOpen ? (
      <div data-testid="mock-modal">
        <h2>{title}</h2>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
  );
  ConfirmModal.propTypes = {
    isOpen: PropTypes.bool,
    title: PropTypes.string,
    onConfirm: PropTypes.func,
    onCancel: PropTypes.func,
  };
  return { ConfirmModal };
});
vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick, disabled, title, className, ...props }) => (
    <button onClick={onClick} disabled={disabled} title={title} className={className} {...props}>
      {children}
    </button>
  )
}));

let mockCallStore = {};
vi.mock('@/stores/useCallStore', () => ({
  useCallStore: Object.assign(
    vi.fn((selector) => selector ? selector(mockCallStore) : mockCallStore),
    { getState: () => mockCallStore }
  )
}));

let mockSessionQuery = {};
vi.mock('@/features/sessions/hooks/useSessionQueries', () => ({
  useSessionPageQuery: vi.fn(() => mockSessionQuery)
}));

let mockGlobalCall = {};
vi.mock('@/features/call/components/GlobalCallProvider', () => ({
  useGlobalCall: vi.fn(() => mockGlobalCall)
}));

let mockCallController = {};
vi.mock('@/features/call/hooks/useCallController', () => ({
  useCallController: vi.fn(() => mockCallController)
}));

let mockLocalMedia = {};
vi.mock('@/features/call/hooks/useLocalMedia', () => ({
  useLocalMedia: vi.fn(() => mockLocalMedia)
}));

vi.mock('@/features/call/hooks/useRemoteMedia', () => ({
  useRemoteMedia: vi.fn(() => ({ consumeTrack: vi.fn() }))
}));

describe('CallWidget', () => {
  const sessionId = 1;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockCallStore = {
      activeSessionId: null,
      callState: 'IDLE',
      connectionState: 'CONNECTED',
      presenceState: 'NOT_JOINED',
      isStarting: false,
      mediaPermissionError: false,
      device: null,
      localMicEnabled: false,
      localCamEnabled: false,
      joinCallSession: vi.fn(),
      setPresenceState: vi.fn(),
      setPeers: vi.fn(),
    };

    mockSessionQuery = {
      data: {
        entity: { status: 'ACTIVE' },
        actions: { canStartCall: false, canJoinCall: true, canEndCall: false },
        viewer: { isParticipant: true }
      }
    };

    mockGlobalCall = {
      rpcClient: {},
      callConfig: {}
    };

    mockCallController = {
      startCall: vi.fn(),
      endCall: vi.fn(),
      joinCall: vi.fn().mockResolvedValue({ routerRtpCapabilities: {}, peers: [] }),
      leaveCall: vi.fn(),
    };

    mockLocalMedia = {
      initDevice: vi.fn().mockResolvedValue({}),
      initTransports: vi.fn().mockResolvedValue(),
      enableMic: vi.fn(),
      disableMic: vi.fn(),
      enableCam: vi.fn(),
      disableCam: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows another session active warning if activeSessionId is different', () => {
    mockCallStore.activeSessionId = 99;
    render(<CallWidget sessionId={sessionId} />);
    
    expect(screen.getByText('Активний інший дзвінок')).toBeInTheDocument();
  });

  it('renders loading state if not connected', () => {
    mockCallStore.connectionState = 'CONNECTING';
    render(<CallWidget sessionId={sessionId} />);
    
    expect(screen.getByText('Підключення до сигнального сервера...')).toBeInTheDocument();
  });

  it('renders IDLE state correctly for GM (can start call)', () => {
    mockSessionQuery.data.actions.canStartCall = true;
    render(<CallWidget sessionId={sessionId} />);
    
    expect(screen.getByText('Дзвінок не активний')).toBeInTheDocument();
    
    const startBtn = screen.getByText('Розпочати дзвінок');
    expect(startBtn).toBeInTheDocument();
    
    fireEvent.click(startBtn);
    expect(mockCallController.startCall).toHaveBeenCalled();
  });

  it('renders IDLE state correctly for Player (cannot start call)', () => {
    mockSessionQuery.data.actions.canStartCall = false;
    render(<CallWidget sessionId={sessionId} />);
    
    expect(screen.getByText('Дзвінок не активний')).toBeInTheDocument();
    expect(screen.queryByText('Розпочати дзвінок')).not.toBeInTheDocument();
  });

  it('renders ACTIVE state (ongoing call, not joined)', () => {
    mockCallStore.callState = 'ACTIVE';
    render(<CallWidget sessionId={sessionId} />);
    
    expect(screen.getByText('Дзвінок триває')).toBeInTheDocument();
    
    const joinBtn = screen.getByText('Приєднатися');
    expect(joinBtn).toBeInTheDocument();
    
    fireEvent.click(joinBtn);
    expect(mockCallController.joinCall).toHaveBeenCalled();
  });

  it('renders IN_CALL state and grid when joined', () => {
    mockCallStore.callState = 'ACTIVE';
    mockCallStore.presenceState = 'JOINED';
    mockCallStore.device = {};
    
    render(<CallWidget sessionId={sessionId} />);
    
    expect(screen.getByTestId('mock-call-grid')).toBeInTheDocument();
    
    const enableMicBtn = screen.getByTitle('Увімкнути мікрофон');
    const enableCamBtn = screen.getByTitle('Увімкнути камеру');
    
    expect(enableMicBtn).toBeInTheDocument();
    expect(enableCamBtn).toBeInTheDocument();
    
    fireEvent.click(enableMicBtn);
    expect(mockLocalMedia.enableMic).toHaveBeenCalled();
    
    fireEvent.click(enableCamBtn);
    expect(mockLocalMedia.enableCam).toHaveBeenCalled();
  });

  it('handles leave call flow', () => {
    mockCallStore.callState = 'ACTIVE';
    mockCallStore.presenceState = 'JOINED';
    mockCallStore.device = {};
    
    render(<CallWidget sessionId={sessionId} />);
    
    const leaveBtn = screen.getByTitle('Покинути дзвінок');
    fireEvent.click(leaveBtn);
    
    const modal = screen.getByTestId('mock-modal');
    expect(modal).toHaveTextContent('Покинути дзвінок?');
    
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockCallController.leaveCall).toHaveBeenCalled();
  });

  it('handles end call flow for GM', () => {
    mockCallStore.callState = 'ACTIVE';
    mockCallStore.presenceState = 'JOINED';
    mockCallStore.device = {};
    mockSessionQuery.data.actions.canEndCall = true;
    
    render(<CallWidget sessionId={sessionId} />);
    
    const endBtn = screen.getByTitle('Завершити для всіх');
    fireEvent.click(endBtn);
    
    const modal = screen.getByTestId('mock-modal');
    expect(modal).toHaveTextContent('Завершити дзвінок?');
    
    fireEvent.click(screen.getByText('Confirm'));
    expect(mockCallController.endCall).toHaveBeenCalled();
  });
});
