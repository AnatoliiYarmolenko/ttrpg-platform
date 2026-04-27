import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { resetPassword } from '../api/authApi';
import useAuthStore from '@/stores/useAuthStore';
import { queryClient } from '@/lib/queryClient';

import AuthInput from "../ui/AuthInput";
import AuthButton from "../ui/AuthButton";
import PasswordStrength from "../ui/PasswordStrength";
import { VALIDATION_RULES } from "../../../utils/validationRules";
import { toast } from '@/stores/useToastStore';
import Dice20 from '@/components/ui/icons/Dice20';

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clearUser = useAuthStore((state) => state.clearUser);
  const resetToken = searchParams.get('token') || '';
  const tokenError = resetToken ? '' : 'Невалідне посилання для скидання. Токен не знайдений.';
  const [success, setSuccess] = useState(false);

  const { 
    register, 
    handleSubmit, 
    control,
    formState: { errors, isSubmitting } 
  } = useForm({ mode: 'onChange' });

  const password = useWatch({ control, name: 'password', defaultValue: '' });

  const onSubmit = async (data) => {
    try {
      await resetPassword({
        resetToken,
        newPassword: data.password,
      });

      setSuccess(true);
      toast.success('Пароль успішно скинуто! Виконується вихід...');
      
      // Розлогінюємо користувача для безпеки після скидання пароля
      clearUser();
      queryClient.clear();
      
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || 'Помилка при скиданні пароля';
      toast.error(message);
    }
  };

  // ВАРІАНТ 1: Якщо помилка токена — показуємо повідомлення замість форми.
  // Зауваж: ми прибрали зовнішні div-обгортки, бо цей контент 
  // автоматично потрапить всередину білої картки AuthLayout.
  if (tokenError) {
      return (
        <div className="text-center py-4">

            <p className="text-brand-dark mb-6 font-medium">{tokenError}</p>
            <Link to="/forgot-password" className="inline-block px-6 py-2 bg-brand-accent hover:bg-brand-medium text-brand-dark hover:text-white rounded-lg transition font-semibold">
                Спробувати ще раз
            </Link>
        </div>
      );
  }

  if (success) {
    return (
      <div className="text-center pt-0 pb-8">
        <Dice20 className="w-16 h-16 text-brand-accent mx-auto " />
        <p className="text-brand-medium font-medium mb-6">Пароль успішно скинуто!</p>
        <p className="text-brand-medium mb-3">Виконується автоматичний перехід на сторінку входу...</p>
        <Link to="/login" className="text-brand-accent hover:text-brand-medium font-semibold transition-colors">
          Перейти до входу зараз
        </Link>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Поле нового пароля */}
      <div>
        <AuthInput
          name="password"
          type="password"
          placeholder="Новий пароль"
          register={register}
          error={errors.password}
          rules={VALIDATION_RULES.password}
        />
        
        <PasswordStrength password={password} />
      </div>

      {/* Поле підтвердження пароля */}
      <AuthInput
        name="confirmPassword"
        type="password"
        placeholder="Підтвердіть пароль"
        register={register}
        error={errors.confirmPassword}
        rules={{
          required: "Підтвердіть пароль",
          validate: (val) => {
            if (password !== val) {
              return "Паролі не збігаються";
            }
            return true;
          }
        }}
      />

      <AuthButton isLoading={isSubmitting || success} loadingText="Збереження...">
        Встановити пароль
      </AuthButton>

      <div className="mt-6 text-center">
        <Link to="/login" className="text-brand-dark hover:text-brand-accent font-semibold transition-colors flex items-center justify-center gap-2">
          Назад до входу
        </Link>
      </div>
    </form>
  );
}