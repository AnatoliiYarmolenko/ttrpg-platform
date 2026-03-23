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

function App() {
  const { isInitialized } = useCsrfInit();

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#164A41] text-white">
        Завантаження...
      </div>
    );
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