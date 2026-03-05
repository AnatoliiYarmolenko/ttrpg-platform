import { toast } from '@/stores/useToastStore';

/**
 * apiAction — helper для зменшення boilerplate в Zustand stores.
 *
 * Замінює повторюваний шаблон:
 *   set({ isLoading: true, error: null });
 *   try { ... if (response.success) ... } catch { ... } finally { ... }
 *
 * @param {Function} set — Zustand set function
 * @param {Object} options
 * @param {Function} options.apiCall — async function: () => response (повинна повертати { success, data, message })
 * @param {string} [options.loadingKey='isLoading'] — ключ завантаження в сторі
 * @param {string} [options.defaultError='Щось пішло не так'] — fallback повідомлення
 * @param {Function} [options.onSuccess] — callback(data, set) при успіху, може бути async
 * @param {string} [options.successMessage] — кастомне повідомлення для success toast
 * @param {string} [options.errorMessage] — кастомне повідомлення для error toast
 * @param {boolean} [options.toastOnSuccess=false] — показувати toast при успіху
 * @param {boolean} [options.toastOnError=true] — показувати toast при помилці
 * @param {boolean} [options.silent=false] — вимкнути всі toasts для цього виклику
 * @param {boolean} [options.setErrorState=true] — записувати помилку в store.error
 * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
 *
 * @example
 * // Простий fetch з оновленням стану:
 * fetchItems: async () =>
 *   apiAction(set, {
 *     apiCall: () => getItems(),
 *     onSuccess: (data) => set({ items: data }),
 *     defaultError: 'Помилка при отриманні елементів',
 *   }),
 *
 * // З гранулярним loading key:
 * fetchMembers: async (id) =>
 *   apiAction(set, {
 *     loadingKey: 'isLoadingMembers',
 *     apiCall: () => getCampaignMembers(id),
 *     onSuccess: (data) => set({ campaignMembers: data }),
 *     defaultError: 'Помилка при отриманні членів',
 *   }),
 */
export async function apiAction(set, {
  apiCall,
  loadingKey = 'isLoading',
  defaultError = 'Щось пішло не так',
  onSuccess,
  successMessage,
  errorMessage,
  toastOnSuccess = false,
  toastOnError = true,
  silent = false,
  setErrorState = true,
}) {
  set({ [loadingKey]: true, error: null });
  try {
    const response = await apiCall();
    if (response.success) {
      if (onSuccess) {
        await onSuccess(response.data, set);
      }

      if (!silent && (toastOnSuccess || successMessage)) {
        toast.success(successMessage || response.message || 'Успішно виконано');
      }

      return { success: true, data: response.data };
    }

    const message = response.message || defaultError;
    if (setErrorState) {
      set({ error: message });
    }

    if (!silent && toastOnError) {
      toast.error(errorMessage || message);
    }

    return { success: false, error: message };
  } catch (err) {
    const message =
      err.response?.data?.error || err.message || defaultError;
    if (setErrorState) {
      set({ error: message });
    }

    if (!silent && toastOnError) {
      toast.error(errorMessage || message);
    }

    return { success: false, error: message };
  } finally {
    set({ [loadingKey]: false });
  }
}
