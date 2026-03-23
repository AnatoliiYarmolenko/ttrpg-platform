import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/stores/useToastStore';
import {
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  deleteAccount,
} from '../api/securityApi';

export const useSecurityMutations = () => {
  const queryClient = useQueryClient();

  const handleMutation = (successMessage, defaultErrorMsg = 'Сталася помилка') => ({
    onSuccess: (data) => {
      if (data && data.success === false) {
        toast.error(data.error || data.message || defaultErrorMsg);
      } else {
        if (successMessage) toast.success(successMessage);
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || defaultErrorMsg);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data) => changePassword(data),
    ...handleMutation('Пароль успішно змінено!', 'Помилка при зміні пароля'),
  });

  const requestEmailChangeMutation = useMutation({
    mutationFn: (data) => requestEmailChange(data),
    ...handleMutation('Лист з підтвердженням відправлено на нову адресу', 'Помилка запиту на зміну email'),
  });

  const confirmEmailChangeMutation = useMutation({
    mutationFn: (token) => confirmEmailChange(token),
    ...handleMutation('Email успішно змінено!', 'Помилка підтвердження email'),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (data) => deleteAccount(data),
    ...handleMutation('Акаунт успішно видалено', 'Помилка при видаленні акаунта'),
  });

  return {
    changePassword: changePasswordMutation,
    requestEmailChange: requestEmailChangeMutation,
    confirmEmailChange: confirmEmailChangeMutation,
    deleteAccount: deleteAccountMutation,
  };
};
