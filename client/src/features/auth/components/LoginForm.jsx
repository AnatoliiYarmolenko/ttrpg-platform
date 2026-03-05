import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom"; // Додали useNavigate
import { loginUser } from "../api/authApi";

import AuthInput from "../ui/AuthInput";
import AuthButton from "../ui/AuthButton";
import { VALIDATION_RULES } from "../../../utils/validationRules";
import { toast } from "@/stores/useToastStore";
function LoginForm({ onSuccess }) {
  const { 
    register, 
    handleSubmit, 
    formState: { isSubmitting, errors } 
  } = useForm();
  const navigate = useNavigate();

  const onSubmit = async (formData) => { // data -> formData для ясності
    try {
      // ❌ Було: const res = await api.post("/api/auth/login", data);
      // ✅ Стало: Викликаємо чисту функцію. URL схований всередині.
      const responseData = await loginUser(formData);

      if (onSuccess) {
        // Увага: authApi повертає response.data, тому тут ми передаємо вже чисті дані
        onSuccess(responseData);
      }
    } catch (error) {
      // Логіка помилок залишається майже такою ж, бо помилки приходять з axios
      const resp = error.response?.data;
      const errorMessage = resp?.message || resp?.error || "";

      // Перехоплення непідтвердженого email
      if (error.response?.status === 403 && 
         (errorMessage.toLowerCase().includes("пошта") || errorMessage.toLowerCase().includes("email"))) {
        navigate("/verify-email-notice", { state: { email: formData.email } });
        return;
      }
      
      // ⚠️ CSRF логіку Retry ми прибираємо звідси!
      // Чому? Бо lib/axios.js повинен додавати токен автоматично.
      // Якщо 403 CSRF стається постійно - це проблема налаштування axios, а не форми.
      
      if (error.response?.status === 429) {
        toast.error(errorMessage || 'Занадто багато спроб. Спробуйте пізніше.');
        return;
      }
      
      if (error.response?.status === 400) {
        toast.error('Невірний email або пароль');
        return;
      }

      if (!error.response) {
        toast.error('Помилка з\'єднання з сервером.');
        return;
      }

      toast.error(errorMessage || 'Помилка сервера.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Поле Email */}
      <AuthInput
        name="email"
        type="email"
        placeholder="Email"
        register={register}
        error={errors.email} 
        rules={VALIDATION_RULES.email}  
      />
      {/* Поле Пароль */}
      <AuthInput
        name="password"
        type="password"
        placeholder="Пароль"
        register={register}
        error={errors.password}
        rules={{ required: VALIDATION_RULES.password.required }}
      />

      <AuthButton isLoading={isSubmitting} loadingText="Вхід...">
        Увійти
      </AuthButton>
      
      <div className="mt-6 text-center">
        <div className="mb-3">
          <Link to="/forgot-password" className="text-[#F1B24A] hover:text-[#4D774E] font-semibold transition-colors text-sm">
            Забули пароль?
          </Link>
        </div>
        <p className="text-[#164A41]">
          Ще немає акаунту?{" "}
          <Link to="/register" className="text-[#F1B24A] hover:text-[#4D774E] font-semibold transition-colors">
            Зареєструватись
          </Link>
        </p>
      </div>
    </form>
  );
}

export default LoginForm;