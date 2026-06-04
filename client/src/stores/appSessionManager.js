/**
 * App Session Manager — централізоване управління життєвим циклом сесії користувача.
 *
 * Цей модуль є єдиною точкою для скидання всіх сторів при logout/зміні юзера,
 * замість того щоб useAuthStore напряму імпортував кожен стор.
 */

import useDashboardStore from './useDashboardStore';
import { useCallStore } from './useCallStore';
import useChatStore from './useChatStore';
import useNotificationStore from './useNotificationStore';
import useSearchStore from './useSearchStore';
import useToastStore from './useToastStore';
import { queryClient } from '@/lib/queryClient';

/**
 * Скидає всі feature-стори до початкового стану.
 * Викликається при logout або зміні користувача.
 */
export function resetAllStores() {
  useDashboardStore.getState().reset();
  useCallStore.getState().reset();
  useChatStore.getState().reset();
  useNotificationStore.getState().reset();
  useSearchStore.getState().reset();
  useToastStore.getState().clearToasts();
  queryClient.clear();
}
