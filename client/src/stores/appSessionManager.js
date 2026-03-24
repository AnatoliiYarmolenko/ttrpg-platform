/**
 * App Session Manager — централізоване управління життєвим циклом сесії користувача.
 *
 * Цей модуль є єдиною точкою для скидання всіх сторів при logout/зміні юзера,
 * замість того щоб useAuthStore напряму імпортував кожен стор.
 *
 * Використання:
 *   import { resetAllStores } from '@/stores/appSessionManager';
 *   resetAllStores(); // при logout або зміні юзера
 */

import useDashboardStore from './useDashboardStore';
import { queryClient } from '@/lib/queryClient';

/**
 * Скидає всі feature-стори до початкового стану.
 * Викликається при logout або зміні користувача.
 */
export function resetAllStores() {
  useDashboardStore.getState().reset();
  queryClient.clear();
}
