import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { resendVerification } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import AuthButton from "../ui/AuthButton";
import AuthInput from "../ui/AuthInput";
import Arrow from '@/components/ui/icons/Arrow';
import { toast } from '@/stores/useToastStore';

export default function VerifyEmailNoticePage() {
  const location = useLocation();
  const initialEmail = location.state?.email || "";

  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState("idle"); 

  const handleResend = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!email) return;

    setStatus("loading");

    try {
      await resendVerification(email);
      setStatus("success");
      toast.success("Лист успішно відправлено повторно!");
    } catch (err) {
      setStatus("error");
      toast.error(err.response?.data?.error || err.response?.data?.message || "Помилка відправки.");
    }
  };

  return (
    <AuthLayout title="Перевірте вашу пошту">
      
      {/* Іконка пошти */}
      <div className="flex justify-center mb-6 -mt-2">
        <div className="bg-green-50 p-4 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="#4D774E" className="w-12 h-12">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
      </div>

      <p className="text-gray-600 mb-6 text-center leading-relaxed">
        Ми надіслали лист із посиланням для підтвердження{initialEmail ? ` на ${initialEmail}` : ""}.
        <br />
        <span className="text-sm text-gray-400 mt-2 block">
          (Не забудьте перевірити папку "Спам")
        </span>
      </p>

      <div className="space-y-4">
        {status !== "success" && (
            <>
            {initialEmail ? (
                <AuthButton 
                    onClick={handleResend} 
                    isLoading={status === "loading"}
                    loadingText="Відправка..."
                    type="button"
                >
                    Надіслати лист знову
                </AuthButton>
            ) : (
                <form onSubmit={handleResend} className="space-y-4">
                    
                    <AuthInput
                        type="email"
                        placeholder="Введіть ваш email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === "loading"}
                    />

                    <AuthButton 
                        isLoading={status === "loading"}
                        loadingText="Відправка..."
                    >
                        Відправити лист
                    </AuthButton>
                </form>
            )}
            </>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-gray-100 text-center">
        <Link 
          to="/login"
          className="inline-flex items-center text-brand-dark hover:text-brand-accent font-semibold transition-colors group" 
        >
          <span className="mr-2 group-hover:-translate-x-1 transition-transform"><Arrow className="w-4 h-4" direction="left" /></span>
          Повернутися до входу
        </Link>
      </div>

    </AuthLayout>
  );
}