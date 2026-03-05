import { useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { registerUser } from "../api/authApi";

// Імпорти твоїх UI компонентів
import AuthInput from "../ui/AuthInput";
import AuthButton from "../ui/AuthButton";
import PasswordStrength from "../ui/PasswordStrength";
import { VALIDATION_RULES } from "../../../utils/validationRules";
import { toast } from "@/stores/useToastStore";

function RegisterForm({ onSuccess }) {
  const { 
    register, 
    handleSubmit, 
    setError, 
    control,
    formState: { isSubmitting, errors } // errors тут є
  } = useForm({ mode: 'onChange' });
  
  // Стежимо за паролем для шкали сили пароля
  const password = useWatch({ control, name: 'password', defaultValue: '' });

  const onSubmit = async (data) => {
    try {
      await registerUser(data);
      if (onSuccess) onSuccess(data.email);
      
    } catch (error) {
      const resp = error.response?.data;
      console.log("Помилка реєстрації:", resp); 

      // 1. Обробка ліміту запитів
      if (error.response?.status === 429) {
        toast.error(resp?.error || 'Занадто багато спроб. Спробуйте пізніше.');
        return;
      }
      
      // 2. Валідація (масив помилок з бекенду)
      if (resp?.errors && Array.isArray(resp.errors)) {
        resp.errors.forEach(e => {
          if (e.path) setError(e.path, { type: 'server', message: e.message });
        });
        return;
      }

      // 3. Валідація (одиночні помилки)
      if (resp?.error) {
         const errorText = resp.error.toLowerCase();
         let handled = false;

         if (errorText.includes('email') || errorText.includes('пошта')) {
           setError('email', { type: 'server', message: 'Цей email вже використовується' });
           handled = true;
         } 
         
         if (errorText.includes('нікнейм') || errorText.includes('username')) {
           setError('username', { type: 'server', message: 'Цей нікнейм зайнятий' });
           handled = true;
         } 

         if (handled) return;

         toast.error(resp.error);
         return;
      }
      
      toast.error('Помилка реєстрації. Спробуйте пізніше.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Поле Нікнейм */}
      <AuthInput
        name="username"
        type="text" // змінив з 'username' на 'text', бо type="username" не існує в HTML
        placeholder="Нікнейм"
        register={register}
        error={errors.username}
        rules={VALIDATION_RULES.username}
      />

      {/* Поле Email */}
      <AuthInput
        name="email"
        type="email"
        placeholder="Email"
        register={register}
        error={errors.email}
        rules={VALIDATION_RULES.email}      />

      {/* Поле Пароль */}
     <AuthInput
        name="password"
        type="password"
        placeholder="Пароль"
        register={register}
        error={errors.password}
        rules={VALIDATION_RULES.password}
      />

      {/* Індикатор сили пароля */}
      <PasswordStrength password={password} />

      <AuthButton isLoading={isSubmitting} loadingText="Реєстрація...">
        Зареєструватись
      </AuthButton>

      <div className="mt-6 text-center">
        <p className="text-[#164A41]">
          Вже є акаунт?{" "}
          <Link to="/login" className="text-[#F1B24A] hover:text-[#4D774E] font-semibold transition-colors">
            Увійти
          </Link>
        </p>
      </div>
    </form>
  );
}

export default RegisterForm;