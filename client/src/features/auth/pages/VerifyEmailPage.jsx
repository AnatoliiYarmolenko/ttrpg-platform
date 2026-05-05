import { useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { verifyEmail } from "../api/authApi"; 
import AuthLayout from "../components/AuthLayout";
import { toast } from "@/stores/useToastStore";
import useAuthStore from "@/stores/useAuthStore";

function useQueryParam() {
  return new URLSearchParams(useLocation().search);
}

export default function VerifyEmailPage() {
  const query = useQueryParam();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = query.get("token");
  
  const destination = isAuthenticated ? "/" : "/login";
  const linkText = isAuthenticated ? "Перейти на головну" : "Перейти до входу";

  const { data, error, isLoading, isSuccess, isError } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: () => verifyEmail(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity, // Запобігаємо повторним запитам
  });

  useEffect(() => {
    if (isSuccess) {
      const successMessage = data?.message || "Email успішно підтверджено! Тепер ви можете увійти.";
      toast.success(successMessage);
      const timer = setTimeout(() => navigate(destination), 4000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, data, navigate, destination]);

  useEffect(() => {
    if (isError) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || "Помилка під час підтвердження email.";
      toast.error(errorMessage);
    }
  }, [isError, error]);

  if (!token) {
    return (
      <AuthLayout title="Підтвердження email">
        <div className="py-4 text-center">
          <p className="font-medium text-red-600">Токен підтвердження не вказано.</p>
          <div className="mt-6">
            <Link to="/login" className="text-brand-dark hover:text-brand-accent font-semibold transition-colors">
              Перейти до входу
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Підтвердження email">
      <div className="py-4 text-center">
        {isLoading && (
          <div className="text-brand-medium animate-pulse font-medium">
            Перевіряємо ваш токен...
          </div>
        )}

        {isSuccess && (
          <p className="font-medium text-brand-medium">
            {data?.message || "Email успішно підтверджено!"}
          </p>
        )}

        {isError && (
          <p className="font-medium text-red-600">
            {error?.response?.data?.error || error?.response?.data?.message || "Помилка під час підтвердження email."}
          </p>
        )}

        {(isSuccess || isError) && (
          <div className="mt-6">
            <Link 
              to={destination}
              className="text-brand-dark hover:text-brand-accent font-semibold transition-colors"
            >
              {linkText}
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}