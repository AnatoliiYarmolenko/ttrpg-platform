import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useSecurityMutations } from '../hooks/useSecurityMutations';
import AuthLayout from '@/features/auth/components/AuthLayout';
import Button from '@/components/ui/Button';

export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { confirmEmailChange } = useSecurityMutations();

  const [status, setStatus] = useState(token ? 'loading' : 'error'); // loading, success, error
  const [newEmail, setNewEmail] = useState('');
  
  const confirmCalled = useRef(false);

  useEffect(() => {
    if (!token) return;
    if (confirmCalled.current) return;
    confirmCalled.current = true;

    confirmEmailChange.mutate(token, {
      onSuccess: (result) => {
        setStatus('success');
        setNewEmail(result?.profile?.email || '');
      },
      onError: () => {
        setStatus('error');
      }
    });
  }, [token, confirmEmailChange]);

  return (
    <AuthLayout 
      title="Зміна Email" 
      subtitle="Підтвердження нової адреси"
    >
      <div className="text-center py-8">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="text-6xl animate-pulse">📧</div>
            <p className="text-brand-medium">Підтвердження email...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-6">
            <div className="text-6xl">✅</div>
            <p className="text-brand-medium font-medium">Email успішно змінено!</p>
            {newEmail && (
              <div className="bg-brand-light/20 rounded-xl p-4">
                <p className="text-sm text-brand-medium">Новий email:</p>
                <p className="font-bold text-brand-dark">{newEmail}</p>
              </div>
            )}
            <p className="text-sm text-brand-medium">
              Тепер використовуйте новий email для входу в акаунт.
            </p>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Перейти до Dashboard
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-6">
            <div className="text-6xl">❌</div>
            <p className="text-red-600 font-medium">Не вдалося підтвердити зміну email.</p>
            <p className="text-sm text-brand-medium">
              Можливо, посилання прострочене або вже було використане.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Повернутися до Dashboard
              </Button>
              <Link 
                to="/login" 
                className="block text-center text-brand-medium hover:text-brand-dark hover:underline"
              >
                Або увійти в акаунт
              </Link>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
