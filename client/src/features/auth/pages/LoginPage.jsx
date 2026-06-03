// LoginPage.jsx
import { useNavigate, useSearchParams } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import AuthLayout from "../components/AuthLayout";
import useAuthStore from '../../../stores/useAuthStore';

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  let returnTo = searchParams.get("returnTo") || "/";
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    returnTo = '/';
  }
  const setUser = useAuthStore((state) => state.setUser);

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
          navigate(returnTo, { replace: true });
        }} 
      />
    </AuthLayout>
  );
}

export default LoginPage;