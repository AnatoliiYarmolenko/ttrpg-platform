// LoginPage.jsx
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import AuthLayout from "../components/AuthLayout";
import { fetchCsrfToken } from "../api/authApi";
import useAuthStore from '../../../stores/useAuthStore';
import logger from "../../../lib/clientLogger";

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  let returnTo = searchParams.get("returnTo") || "/";
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    returnTo = '/';
  }
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    fetchCsrfToken().catch((error) => logger.error(error));
  }, []);

  return (
    <AuthLayout 
      title="Вхід" 
      subtitle="Раді бачити вас знову!"
    >
      <LoginForm 
        onSuccess={async (data) => {
          const userData = data.user; 
          if (userData) {
            setUser(userData);
          }
          await new Promise(resolve => setTimeout(resolve, 100));
          navigate(returnTo, { replace: true });
        }} 
      />
    </AuthLayout>
  );
}

export default LoginPage;