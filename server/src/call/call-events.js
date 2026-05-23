module.exports = {
  // Server to client events
  CALL_EVENTS: {
    STARTED: 'call:started',
    ENDED: 'call:ended',
    PARTICIPANT_JOINED: 'call:participant-joined',
    PARTICIPANT_LEFT: 'call:participant-left',
    PRODUCER_ADDED: 'call:producer-added',
    PRODUCER_CLOSED: 'call:producer-closed',
    MEDIA_STATE_CHANGED: 'call:media-state-changed',
  },
  
  // Call States
  CALL_STATES: {
    IDLE: 'IDLE',
    ACTIVE: 'ACTIVE',
    ENDED: 'ENDED',
  }
};
