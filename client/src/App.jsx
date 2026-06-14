import { useEffect } from "react";
import { BrowserRouter, useNavigate } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { useCsrfInit } from "./hooks/useCsrfInit";
import ToastViewport from "./components/ui/toast/ToastViewport";
import useAuthStore from "./stores/useAuthStore";
import GlobalNotificationProvider from "./features/notifications/components/GlobalNotificationProvider";
import { GlobalCallProvider } from "./features/call/components/GlobalCallProvider";
import { GlobalInCallBadge } from "./features/call/components/GlobalInCallBadge";
import FullPageLoader from "./components/shared/FullPageLoader";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

function AuthExpiredRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthExpired = (event) => {
      useAuthStore.getState().clearUser();
      const redirectTo = event?.detail?.redirectTo || '/login';
      navigate(redirectTo, { replace: true });
    };

    globalThis.addEventListener('app:auth-expired', handleAuthExpired);
    return () => globalThis.removeEventListener('app:auth-expired', handleAuthExpired);
  }, [navigate]);

  return null;
}

function App() {
  const { isInitialized } = useCsrfInit();

  if (!isInitialized) {
    return <FullPageLoader text="Завантаження ініціативи..." />;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthExpiredRedirectListener />
        <GlobalNotificationProvider />
        <GlobalCallProvider>
          <AppRoutes />
          <GlobalInCallBadge />
          <ToastViewport />
        </GlobalCallProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
export default App;