import React, { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { confirmEmailChange } from '../api/securityApi';
import AuthLayout from '@/features/auth/components/AuthLayout';
import Button from '@/components/ui/Button';
import { toast } from '@/stores/useToastStore';

export default function ConfirmEmailChangePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = searchParams.get('token');

  const { data, error, isLoading, isSuccess, isError } = useQuery({
    queryKey: ['confirm-email-change', token],
    queryFn: () => confirmEmailChange(token),
    enabled: !!token,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!isSuccess) return;

    toast.success(data?.message || 'Email успішно змінено!');
    queryClient.invalidateQueries({ queryKey: ['profile'] });
  }, [isSuccess, data, queryClient]);

  useEffect(() => {
    if (!isError) return;

    toast.error(
      error?.response?.data?.error
      || error?.response?.data?.message
      || 'Не вдалося підтвердити зміну email.'
    );
  }, [isError, error]);

  const confirmedEmail = data?.profile?.email || data?.email || '';

  if (!token) {
    return (
      <AuthLayout 
        title="Зміна Email" 
        subtitle="Підтвердження нової адреси"
      >
        <div className="text-center py-8">
          <div className="space-y-6">
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
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Зміна Email" 
      subtitle="Підтвердження нової адреси"
    >
      <div className="text-center py-8">
        {isLoading && (
          <div className="space-y-4">
            <p className="text-brand-medium">Підтвердження email...</p>
          </div>
        )}

        {isSuccess && (
          <div className="space-y-6">
            <p className="text-brand-medium font-medium">Email успішно змінено!</p>
            {confirmedEmail && (
              <div className="bg-brand-light/20 rounded-xl p-4">
                <p className="text-sm text-brand-medium">Новий email:</p>
                <p className="font-bold text-brand-dark">{confirmedEmail}</p>
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

        {isError && (
          <div className="space-y-6">
            <p className="text-red-600 font-medium">Не вдалося підтвердити зміну email.</p>
            <p className="text-sm text-brand-medium">
              Можливо, посилання прострочене або вже було використане.
            </p>
            <div className="space-y-3">
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Повернутися до Dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
