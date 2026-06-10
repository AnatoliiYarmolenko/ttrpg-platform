import React, { useState } from 'react';
import PropTypes from 'prop-types';
import BaseModal from '@/components/shared/BaseModal';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import { useTopUpMutation } from '../hooks/useWalletQueries';

export default function TopUpModal({ isOpen, onClose }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const topUpMutation = useTopUpMutation();

  const handleQuickAdd = (value) => {
    setError('');
    setAmount((prev) => {
      const current = Number.parseFloat(prev) || 0;
      const newValue = current + value;
      return newValue.toFixed(2).replace(/\.?0+$/, '');
    });
  };

  const handleAmountChange = (e) => {
    const val = e.target.value;
    setError('');
    
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setAmount(val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = Number.parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Сума поповнення має бути більшою за нуль');
      return;
    }

    if (parsedAmount > 10000) {
      setError('Сума поповнення не може перевищувати 10,000 Demo Coins');
      return;
    }

    try {
      await topUpMutation.mutateAsync({ amount: parsedAmount });
      setAmount('');
      onClose();
    } catch {
      // помилка вже виводиться через toast в хуку useTopUpMutation
    }
  };

  const inputClasses = `
    w-full p-3 border-2 border-brand-light/50 rounded-xl focus:border-brand-dark text-brand-dark bg-white transition-colors
    ${error ? 'border-red-500 focus:border-red-500' : ''}
  `;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      closeWhileLoading={false}
      isLoading={topUpMutation.isPending}
      panelClassName="max-w-md"
    >
      <div className="rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-bold text-brand-dark">Поповнення балансу</h3>
        <p className="mb-4 text-sm text-brand-medium">
          Поповнюйте рахунок Demo Coins для оплати ігрових сесій.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField id="topup-amount" label="Сума поповнення (Demo Coins)" required>
            <input
              id="topup-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0.00"
              className={inputClasses}
              disabled={topUpMutation.isPending}
              required
            />
            {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          </FormField>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickAdd(100)}
              disabled={topUpMutation.isPending}
              className="py-2 px-3 rounded-lg border border-brand-light/40 bg-brand-light/5 text-brand-dark text-xs font-semibold hover:bg-brand-light/10 transition-colors shadow-none hover:shadow-none"
            >
              +100
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(500)}
              disabled={topUpMutation.isPending}
              className="py-2 px-3 rounded-lg border border-brand-light/40 bg-brand-light/5 text-brand-dark text-xs font-semibold hover:bg-brand-light/10 transition-colors shadow-none hover:shadow-none"
            >
              +500
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(1000)}
              disabled={topUpMutation.isPending}
              className="py-2 px-3 rounded-lg border border-brand-light/40 bg-brand-light/5 text-brand-dark text-xs font-semibold hover:bg-brand-light/10 transition-colors shadow-none hover:shadow-none"
            >
              +1000
            </button>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              type="button"
              onClick={onClose}
              disabled={topUpMutation.isPending}
              variant="outline"
              fullWidth
              className="flex-1 min-h-[44px]"
            >
              Скасувати
            </Button>
            <Button
              type="submit"
              isLoading={topUpMutation.isPending}
              loadingText="Обробка..."
              variant="primary"
              fullWidth
              className="flex-1 min-h-[44px]"
            >
              Поповнити
            </Button>
          </div>
        </form>
      </div>
    </BaseModal>
  );
}

TopUpModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
