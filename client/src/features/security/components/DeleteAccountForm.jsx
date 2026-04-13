import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityMutations } from '../hooks/useSecurityMutations';
import FormField, { getFormFieldControlClasses } from '@/components/ui/FormField';
import { toast } from '@/stores/useToastStore';

export default function DeleteAccountForm() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 - попередження, 2 - форма
  const { deleteAccount } = useSecurityMutations();
  const deleting = deleteAccount.isPending;
  
  const [formData, setFormData] = useState({
    password: '',
    confirmation: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.password) {
      nextErrors.password = 'Введіть пароль';
    }
    if (formData.confirmation !== 'ВИДАЛИТИ') {
      nextErrors.confirmation = 'Введіть "ВИДАЛИТИ" для підтвердження';
    }

    if (Object.keys(nextErrors).length > 0) {
      toast.error(Object.values(nextErrors)[0]);
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    deleteAccount.mutate(formData, {
      onSuccess: () => {
        localStorage.removeItem('ttrpg_app_user');
        navigate('/login', { 
          replace: true,
          state: { message: 'Ваш акаунт було успішно видалено' }
        });
      }
    });
  };

  // Крок 1: Попередження
  if (step === 1) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex gap-3">
            <div>
              <h4 className="font-bold text-red-700 mb-2">Увага! Ця дія незворотна!</h4>
              <p className="text-sm text-red-600 mb-3">
                При видаленні акаунту буде втрачено:
              </p>
              <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                <li>Усі ваші персонажі та їх історія</li>
                <li>Кампанії, де ви були власником</li>
                <li>Історія сесій та повідомлення</li>
                <li>Баланс гаманця та транзакції</li>
                <li>Статистика та досягнення</li>
              </ul>
            </div>
          </div>
        </div>
        
        <button
          onClick={() => setStep(2)}
          className="w-full py-3 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 transition-colors"
        >
          Я розумію, продовжити видалення
        </button>
      </div>
    );
  }

  // Крок 2: Форма підтвердження
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-red-50 border border-red-300 rounded-xl p-4 text-center">
        <p className="text-red-700 font-medium">
          Для підтвердження видалення введіть пароль та слово "ВИДАЛИТИ"
        </p>
      </div>

      {/* Пароль */}
      <FormField
        id="delete-password"
        label="Ваш пароль"
        error={fieldErrors.password}
      >
        <div className="relative">
          <input
            id="delete-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Введіть пароль"
            className={getFormFieldControlClasses({
              error: fieldErrors.password,
              className: 'pr-12 border-red-200 focus:border-red-500',
            })}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-600 transition-colors"
          >
            {showPassword ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            )}
          </button>
        </div>
      </FormField>

      {/* Підтвердження */}
      <FormField
        as="input"
        id="delete-confirmation"
        name="confirmation"
        type="text"
        label={'Введіть "ВИДАЛИТИ" для підтвердження'}
        value={formData.confirmation}
        onChange={handleChange}
        placeholder="ВИДАЛИТИ"
        autoComplete="off"
        controlClassName="border-red-200 focus:border-red-500"
        error={fieldErrors.confirmation}
      >
        {formData.confirmation && formData.confirmation !== 'ВИДАЛИТИ' && !fieldErrors.confirmation && (
          <p className="text-xs text-red-500 mt-1">
            Введіть точно: ВИДАЛИТИ
          </p>
        )}
        {formData.confirmation === 'ВИДАЛИТИ' && (
          <p className="text-xs text-green-600 mt-1">
            ✓ Підтвердження правильне
          </p>
        )}
      </FormField>

      {/* Кнопки */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => setStep(1)}
          className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          disabled={deleting}
        >
          Скасувати
        </button>
        <button
          type="submit"
          disabled={deleting || formData.confirmation !== 'ВИДАЛИТИ'}
          className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
        >
          {deleting ? 'Видалення...' : 'Видалити назавжди'}
        </button>
      </div>
    </form>
  );
}
