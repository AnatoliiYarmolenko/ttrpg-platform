/**
 * Auth Store - Централізований state management для авторизації
 * Використовує Zustand з persist middleware для синхронізації з localStorage
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { resetAllStores } from './appSessionManager';

const STORAGE_KEY = 'ttrpg_app_user';

/**
 * @typedef {Object} User
 * @property {number} id - ID користувача
 * @property {string} username - Ім'я користувача
 * @property {string} email - Email користувача
 * @property {string} [avatar] - URL аватара
 * @property {string} [bio] - Біографія
 * @property {string} [location] - Локація
 * @property {string} createdAt - Дата реєстрації
 */

/**
 * @typedef {Object} AuthState
 * @property {User|null} user - Поточний користувач
 * @property {boolean} isAuthenticated - Чи авторизований користувач
 * @property {boolean} isLoading - Чи завантажуються дані
 * @property {boolean} isHydrated - Чи відновлено стан з localStorage
 * @property {boolean} isSessionValidated - Чи підтверджена сесія сервером
 */

/**
 * @typedef {Object} AuthActions
 * @property {(user: User) => void} setUser - Встановити користувача (login)
 * @property {(updates: Partial<User>) => void} updateUser - Оновити дані користувача
 * @property {() => void} clearUser - Очистити користувача (logout)
 * @property {(loading: boolean) => void} setLoading - Встановити стан завантаження
 * @property {() => void} setHydrated - Позначити, що стан відновлено
 * @property {(validated: boolean) => void} setSessionValidated - Позначити результат серверної перевірки сесії
 */

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isHydrated: false,
      isSessionValidated: false,
      
      /**
       * Встановити користувача після успішного логіну
       * @param {User} user - Дані користувача
       */
      setUser: (user) => {
        const currentUserId = get().user?.id;

        if (currentUserId && currentUserId !== user?.id) {
          resetAllStores();
        }

        set({ 
          user, 
          isAuthenticated: true,
          isLoading: false,
          isSessionValidated: true,
        });
      },

      /**
       * Оновити дані користувача (наприклад, після редагування профілю)
       * @param {Partial<User>} updates - Оновлення
       */
      updateUser: (updates) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ 
            user: { ...currentUser, ...updates } 
          });
        }
      },

      clearUser: () => {
        resetAllStores();

        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false,
          isSessionValidated: true,
        });
      },

      /**
       * Встановити стан завантаження
       * @param {boolean} loading 
       */
      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setHydrated: () => {
        set({ isHydrated: true });
      },

      /**
       * Позначити, що серверна перевірка сесії завершена
       * @param {boolean} validated
       */
      setSessionValidated: (validated) => {
        set({ isSessionValidated: validated });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated }),
      
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
          state.isSessionValidated = false;
        }
      },
    }
  )
);

export default useAuthStore;

/**
 * Селектор для отримання тільки user
 * Використовуйте: const user = useAuthStore(selectUser)
 */
export const selectUser = (state) => state.user;

/**
 * Селектор для перевірки авторизації
 * Використовуйте: const isAuth = useAuthStore(selectIsAuthenticated)
 */
export const selectIsAuthenticated = (state) => state.isAuthenticated;

/**
 * Селектор для перевірки ролі адміністратора
 * Використовуйте: const isAdmin = useAuthStore(selectIsAdmin)
 */
export const selectIsAdmin = (state) => state.user?.role === 'ADMIN';

/**
 * Селектор для стану завантаження
 */
export const selectIsLoading = (state) => state.isLoading;

/**
 * Селектор для стану гідратації
 */
export const selectIsHydrated = (state) => state.isHydrated;
