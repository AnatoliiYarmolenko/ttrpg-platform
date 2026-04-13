import React from 'react';
import Dice20 from '@/components/ui/icons/Dice20';

/**
 * ErrorScreen — повноекранний стан помилки.
 *
 * Використовується в CampaignPage, SessionPage (та інших)
 * для уніфікованого відображення помилки з можливістю навігації.
 *
 * @param {Object} props
 * @param {string} props.message — текст помилки
 * @param {Function} [props.onAction] — callback при натисканні кнопки
 * @param {string} [props.actionLabel='На головну'] — текст кнопки
 */
export default function ErrorScreen({
  message,
  onAction,
  actionLabel = 'На головну',
}) {
  // Normalize error message: extract from Error object, handle null/undefined
  const errorMessage = message
    ? typeof message === 'string'
      ? message
      : message.message || String(message)
    : 'Сталася невідома помилка';

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 mb-4 rounded-2xl border-2 border-white/40 bg-brand-medium flex items-center justify-center">
        <Dice20 className="w-8 h-8 text-brand-accent" />
      </div>
      <p className="text-xl mb-4">{errorMessage}</p>
      {onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2 bg-white text-brand-dark rounded-xl font-bold hover:bg-gray-100 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
