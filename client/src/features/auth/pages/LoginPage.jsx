// LoginPage.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import AuthLayout from "../components/AuthLayout"; // Імпортуємо обгортку
import { fetchCsrfToken } from "../api/authApi";
import useAuthStore from '../../../stores/useAuthStore';
import logger from "../../../lib/clientLogger";

function LoginPage() {
  const navigate = useNavigate();
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
          // Невелика затримка, щоб браузер встиг встановити cookies
          await new Promise(resolve => setTimeout(resolve, 100));
          navigate("/", { replace: true });
        }} 
      />
    </AuthLayout>
  );
}

export default LoginPage;