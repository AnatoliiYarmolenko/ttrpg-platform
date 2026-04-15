export const SESSION_TABS = {
  DETAILS: 'details',
  COMMUNICATION: 'communication',
  SETTINGS: 'settings',
  MANAGE: 'manage',
};

export const COMMUNICATION_MODES = {
  CHAT: 'chat',
  PARTICIPANTS: 'participants',
};

export const SESSION_TAB_VALUES = Object.values(SESSION_TABS);
export const COMMUNICATION_MODE_VALUES = Object.values(COMMUNICATION_MODES);

export function buildSessionTabs({ canManageSettings = false, canManageSession = false } = {}) {
  return [
    { key: SESSION_TABS.DETAILS, label: 'Деталі' },
    { key: SESSION_TABS.COMMUNICATION, label: 'Комунікація' },
    ...(canManageSettings ? [{ key: SESSION_TABS.SETTINGS, label: 'Налаштування' }] : []),
    ...(canManageSession ? [{ key: SESSION_TABS.MANAGE, label: 'Керування' }] : []),
  ];
}

