import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom"; // Додали useNavigate
import PropTypes from "prop-types";
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

  const onSubmit = async (formData) => {
    try {
      const responseData = await loginUser(formData);

      if (onSuccess) {
        onSuccess(responseData);
      }
    } catch (error) {
      const resp = error.response?.data;
      const errorMessage = resp?.message || resp?.error || "";

      if (error.response?.status === 403 && 
         (errorMessage.toLowerCase().includes("пошта") || errorMessage.toLowerCase().includes("email"))) {
        navigate("/verify-email-notice", { state: { email: formData.email } });
        return;
      }
            
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
      <AuthInput
        name="email"
        type="email"
        placeholder="Email"
        register={register}
        error={errors.email} 
        rules={VALIDATION_RULES.email}  
      />
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
          <Link to="/forgot-password" className="text-brand-accent hover:text-brand-medium font-semibold transition-colors text-sm">
            Забули пароль?
          </Link>
        </div>
        <p className="text-brand-dark">
          Ще немає акаунту?{" "}
          <Link to="/register" className="text-brand-accent hover:text-brand-medium font-semibold transition-colors">
            Зареєструватись
          </Link>
        </p>
      </div>
    </form>
  );
}

LoginForm.propTypes = {
  onSuccess: PropTypes.func,
};

export default LoginForm;