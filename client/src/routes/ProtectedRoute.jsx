import { Navigate } from "react-router-dom";
import { useEffect, useRef, useCallback } from "react";
import { getCurrentUser } from "../features/auth/api/authApi"; 
import useAuthStore from '../stores/useAuthStore';
import FullPageLoader from "../components/shared/FullPageLoader";

const MIN_CHECK_INTERVAL = 30 * 1000;

function ProtectedRoute({ children }) {
  // Використовуємо Zustand store
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isSessionValidated = useAuthStore((state) => state.isSessionValidated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const setSessionValidated = useAuthStore((state) => state.setSessionValidated);

  const lastCheckRef = useRef(0);
  const hasCheckedRef = useRef(false);

  const checkAuth = useCallback(async (showLoading = false) => {
    if (showLoading) setSessionValidated(false);
    if (showLoading) setLoading(true);
    
    try {
      const userDataFromApi = await getCurrentUser();
      
      if (userDataFromApi?.id) {
        // Оновлюємо store - Zustand сам порівняє і не оновить, якщо дані однакові
        setUser(userDataFromApi);
      } else {
        clearUser();
      }
    } catch {
      // Очищаємо store при помилці автентифікації
      clearUser();
    } finally {
      if (showLoading) setSessionValidated(true);
      if (showLoading) setLoading(false);
    }
  }, [setUser, clearUser, setLoading, setSessionValidated]);
  
  useEffect(() => {
    // Виконуємо перевірку тільки один раз при монтуванні
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    
    checkAuth(true);

    const tryCheckOnVisible = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastCheckRef.current > MIN_CHECK_INTERVAL) {
          lastCheckRef.current = now;
          checkAuth(false);
        }
      }
    };

    document.addEventListener('visibilitychange', tryCheckOnVisible);

    return () => {
      document.removeEventListener('visibilitychange', tryCheckOnVisible);
    };
  }, [checkAuth]);

  // Не рендеримо приватний екран, поки не завершено первинну серверну перевірку сесії.
  if (!isHydrated || !isSessionValidated || isLoading) {
    return <FullPageLoader text="Перевірка доступу..." />;
  }

  // Якщо після гідратації та завантаження не авторизований - редірект на логін
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;