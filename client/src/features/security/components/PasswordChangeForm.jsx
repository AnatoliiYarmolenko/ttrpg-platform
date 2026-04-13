import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSecurityMutations } from '../hooks/useSecurityMutations';
import Button from '@/components/ui/Button';
import PasswordStrength from '@/features/auth/ui/PasswordStrength';
import { toast } from '@/stores/useToastStore';

export default function PasswordChangeForm() {
  const { changePassword } = useSecurityMutations();
  const saving = changePassword.isPending;
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Показувати/ховати паролі
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const togglePassword = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Валідація перед відправкою
  const validateForm = () => {
    if (!formData.currentPassword) {
      toast.error('Введіть поточний пароль');
      return false;
    }
    if (!formData.newPassword) {
      toast.error('Введіть новий пароль');
      return false;
    }
    if (formData.newPassword.length < 8) {
      toast.error('Новий пароль має містити мінімум 8 символів');
      return false;
    }
    if (!/[a-zа-яіїєґ]/.test(formData.newPassword)) {
      toast.error('Пароль має містити малу літеру');
      return false;
    }
    if (!/[A-ZА-ЯІЇЄҐ]/.test(formData.newPassword)) {
      toast.error('Пароль має містити велику літеру');
      return false;
    }
    if (!/\d/.test(formData.newPassword)) {
      toast.error('Пароль має містити цифру');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('Паролі не співпадають');
      return false;
    }
    if (formData.currentPassword === formData.newPassword) {
      toast.error('Новий пароль має відрізнятися від поточного');
      return false;
    }
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    changePassword.mutate(formData, {
      onSuccess: () => {
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    });
  };

  const inputClasses = "w-full px-4 py-3 pr-12 rounded-xl border-2 border-brand-light/30 focus:border-brand-dark focus:outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Поточний пароль */}
      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-brand-dark mb-2">
          Поточний пароль
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            type={showPasswords.current ? 'text' : 'password'}
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            placeholder="Введіть поточний пароль"
            className={inputClasses}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => togglePassword('current')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-medium hover:text-brand-dark transition-colors"
          >
            {showPasswords.current ? (
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
      </div>

      {/* Новий пароль */}
      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-brand-dark mb-2">
          Новий пароль
        </label>
        <div className="relative">
          <input
            id="newPassword"
            type={showPasswords.new ? 'text' : 'password'}
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            placeholder="Введіть новий пароль"
            className={inputClasses}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => togglePassword('new')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-medium hover:text-brand-dark transition-colors"
          >
            {showPasswords.new ? (
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
        {/* Індикатор сили пароля */}
        <PasswordStrength password={formData.newPassword} />
      </div>

      {/* Підтвердження пароля */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-brand-dark mb-2">
          Підтвердіть новий пароль
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showPasswords.confirm ? 'text' : 'password'}
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="Повторіть новий пароль"
            className={inputClasses}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => togglePassword('confirm')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-medium hover:text-brand-dark transition-colors"
          >
            {showPasswords.confirm ? (
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
        {/* Підказка співпадіння */}
        {formData.confirmPassword && (
          <p className={`text-xs mt-2 ${formData.newPassword === formData.confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
            {formData.newPassword === formData.confirmPassword ? '✓ Паролі співпадають' : '✗ Паролі не співпадають'}
          </p>
        )}
      </div>

      {/* Кнопка збереження */}
      <div className="pt-4">
        <Button 
          type="submit" 
          disabled={saving}
          className="w-full"
        >
          {saving ? 'Зміна пароля...' : 'Змінити пароль'}
        </Button>
      </div>

      {/* Забули пароль? */}
      <div className="text-center">
        <Link 
          to="/forgot-password" 
          className="text-sm text-brand-medium hover:text-brand-dark hover:underline transition-colors"
        >
          Не пам'ятаєте поточний пароль?
        </Link>
      </div>

      {/* Підказка безпеки */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
        <div className="flex gap-2">
          <span>⚠️</span>
          <div className="text-sm text-amber-800">
            <p className="font-medium">Після зміни пароля:</p>
            <ul className="list-disc list-inside mt-1 text-xs">
              <li>Використовуйте новий пароль для входу</li>
              <li>Рекомендуємо оновити пароль в менеджері паролів</li>
            </ul>
          </div>
        </div>
      </div>
    </form>
  );
}
