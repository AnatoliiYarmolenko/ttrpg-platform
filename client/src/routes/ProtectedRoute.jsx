import { Navigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { useEffect, useRef, useCallback } from "react";
import { getCurrentUser } from "../features/auth/api/authApi";
import useAuthStore from '../stores/useAuthStore';
import FullPageLoader from "../components/shared/FullPageLoader";

const MIN_CHECK_INTERVAL = 30 * 1000;

function ProtectedRoute({ children, requireAuth = true }) {
  const location = useLocation();
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

  const isAuthFailure = useCallback((error) => {
    const status = error?.response?.status;
    return status === 401 || status === 403;
  }, []);

  const checkAuth = useCallback(async (showLoading = false) => {
    if (showLoading) setSessionValidated(false);
    if (showLoading) setLoading(true);

    try {
      const userDataFromApi = await getCurrentUser();

      if (userDataFromApi?.id) {
        setUser(userDataFromApi);
      } else {
        clearUser();
      }
    } catch (error) {
      if (isAuthFailure(error)) {
        clearUser();
      }
    } finally {
      if (showLoading) setSessionValidated(true);
      if (showLoading) setLoading(false);
    }
  }, [setUser, clearUser, setLoading, setSessionValidated, isAuthFailure]);

  useEffect(() => {
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

  if (!isHydrated || !isSessionValidated || isLoading) {
    return <FullPageLoader text="Завантаження..." />;
  }

  if (requireAuth && !isAuthenticated) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requireAuth: PropTypes.bool,
};

export default ProtectedRoute;
