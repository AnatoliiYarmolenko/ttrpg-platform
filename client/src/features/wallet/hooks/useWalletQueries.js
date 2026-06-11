import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyWallet, getMyTransactions, topUpWallet } from '../api/walletApi';
import { toast } from '@/stores/useToastStore';
import { invalidateWalletQuery } from '@/lib/queryInvalidation';

/**
 * Хук для отримання поточного гаманця та балансу користувача
 */
export const useMyWalletQuery = () => {
  return useQuery({
    queryKey: ['wallet', 'me'],
    queryFn: async () => {
      const result = await getMyWallet();
      if (!result?.success) throw new Error(result?.message || 'Не вдалося завантажити баланс');
      return result.wallet;
    },
    staleTime: 30 * 1000,
  });
};

/**
 * Хук для отримання історії транзакцій користувача
 * @param {Object} [params]
 * @param {number} [params.limit=10]
 * @param {number} [params.offset=0]
 */
export const useWalletTransactionsQuery = (params = {}) => {
  const limit = params.limit ?? 10;
  const offset = params.offset ?? 0;

  return useQuery({
    queryKey: ['wallet', 'transactions', { limit, offset }],
    queryFn: async () => {
      const result = await getMyTransactions({ limit, offset });
      if (!result?.success) throw new Error(result?.message || 'Не вдалося завантажити транзакції');
      return result;
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Хук для поповнення балансу гаманця
 */
export const useTopUpMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data) => topUpWallet(data),
    onSuccess: (result, variables) => {
      if (result.success && result.wallet) {

        queryClient.setQueryData(['wallet', 'me'], result.wallet);

        invalidateWalletQuery(queryClient);
        toast.success(`Рахунок успішно поповнено на ${Number(variables.amount).toFixed(2)} Demo Coins.`);
      } else {
        invalidateWalletQuery(queryClient);
      }
    },
    onError: (err) => {
      const errorMessage = err.response?.data?.message || err.response?.data?.error || 'Помилка поповнення гаманця';
      toast.error(errorMessage);
    },
  });
};
