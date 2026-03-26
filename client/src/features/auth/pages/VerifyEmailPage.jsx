import { useEffect, useState, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { verifyEmail } from "../api/authApi"; 
import AuthLayout from "../components/AuthLayout";
import { toast } from "@/stores/useToastStore";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function VerifyEmailPage() {
  const query = useQuery();
  const navigate = useNavigate();
  const token = query.get("token");
  const [status, setStatus] = useState(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "" : "Токен підтвердження не вказано.");
  
  const verifyCalled = useRef(false);

  const verifyMutation = useMutation({
    mutationFn: (token) => verifyEmail(token),
  });
  const { mutate: verifyEmailMutation } = verifyMutation;

  useEffect(() => {
    if (!token) return;

    if (verifyCalled.current) return;
    verifyCalled.current = true;

    verifyEmailMutation(token, {
      onSuccess: (data) => {
        setStatus("success");
        const successMessage = data.message || "Email успішно підтверджено! Тепер ви можете увійти.";
        setMessage(successMessage);
        toast.success(successMessage);
        setTimeout(() => navigate("/login"), 4000);
      },
      onError: (err) => {
        setStatus("error");
        const errorMessage = err.response?.data?.error || err.response?.data?.message || "Помилка під час підтвердження email.";
        setMessage(errorMessage);
        toast.error(errorMessage);
      }
    });
  }, [token, navigate, verifyEmailMutation]);
  
  return (
    <AuthLayout title="Підтвердження email">
      
      <div className="py-4 text-center">
        {status === "loading" && (
            <div className="text-[#4D774E] animate-pulse font-medium">
               ⏳ Перевіряємо ваш токен...
            </div>
        )}

        {status !== "loading" && (
          <p className={`font-medium ${status === "success" ? "text-[#4D774E]" : "text-red-600"}`}>
            {message}
          </p>
        )}

        {status !== "loading" && (
          <div className="mt-6">
            <Link 
                to="/login" 
                className="text-[#164A41] hover:text-[#F1B24A] font-semibold transition-colors border-b-2 border-transparent hover:border-[#F1B24A]"
            >
              Перейти до входу
            </Link>
          </div>
        )}
      </div>

    </AuthLayout>
  );
}