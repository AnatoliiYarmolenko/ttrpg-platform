import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { useCsrfInit } from "./hooks/useCsrfInit"; 
import ToastViewport from "./components/ui/toast/ToastViewport";
import useAuthStore from "./stores/useAuthStore";

function AuthExpiredRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthExpired = (event) => {
      useAuthStore.getState().clearUser();
      const redirectTo = event?.detail?.redirectTo || '/login';
      navigate(redirectTo, { replace: true });
    };

    window.addEventListener('app:auth-expired', handleAuthExpired);
    return () => window.removeEventListener('app:auth-expired', handleAuthExpired);
  }, [navigate]);

  return null;
}

import FullPageLoader from "./components/shared/FullPageLoader";

function App() {
  const { isInitialized } = useCsrfInit();

  if (!isInitialized) {
    return <FullPageLoader text="Завантаження ініціативи..." />;
  }

  return (
    <BrowserRouter>
      <AuthExpiredRedirectListener />
      <AppRoutes />
      <ToastViewport />
    </BrowserRouter>
  );
}
export default App;