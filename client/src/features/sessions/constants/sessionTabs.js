export const SESSION_TABS = {
  DETAILS: 'details',
  COMMUNICATION: 'communication',
  SETTINGS: 'settings',
  VTT: 'vtt',
};

export const COMMUNICATION_MODES = {
  CHAT: 'chat',
  PARTICIPANTS: 'participants',
};

export const SESSION_TAB_VALUES = Object.values(SESSION_TABS);
export const COMMUNICATION_MODE_VALUES = Object.values(COMMUNICATION_MODES);

export function buildSessionTabs({ canManageSettings = false, canManageSession = false, isSessionActive = false } = {}) {
  const canOpenManageTab = Boolean(canManageSettings || canManageSession);

  return [
    { key: SESSION_TABS.DETAILS, label: 'Деталі' },
    { key: SESSION_TABS.COMMUNICATION, label: 'Комунікація' },
    ...(canOpenManageTab ? [{ key: SESSION_TABS.SETTINGS, label: 'Керування' }] : []),
    ...(isSessionActive ? [{ key: SESSION_TABS.VTT, label: 'Ігровий стіл', isVttTab: true }] : []),
  ];
}
