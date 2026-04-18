export const CAMPAIGN_TABS = {
  DETAILS: 'details',
  SESSIONS: 'sessions',
  MANAGE: 'manage',
};

export const CAMPAIGN_COMMUNICATION_MODES = {
  CHAT: 'chat',
  MEMBERS: 'members',
};

export const CAMPAIGN_TAB_VALUES = Object.values(CAMPAIGN_TABS);
export const CAMPAIGN_COMMUNICATION_MODE_VALUES = Object.values(CAMPAIGN_COMMUNICATION_MODES);

/**
 * Будує список доступних табів кампанії залежно від ролі.
 *
 * @param {boolean} canManage — чи може юзер керувати кампанією (лише Owner)
 */
export function buildCampaignTabs({ canManage = false } = {}) {
  return [
    { key: CAMPAIGN_TABS.DETAILS, label: 'Деталі' },
    { key: CAMPAIGN_TABS.SESSIONS, label: 'Сесії' },
    ...(canManage ? [{ key: CAMPAIGN_TABS.MANAGE, label: 'Керування' }] : []),
  ];
}
