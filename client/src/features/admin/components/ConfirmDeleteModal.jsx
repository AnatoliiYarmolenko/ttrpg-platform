import React from 'react';
import Button from '@/components/ui/Button';

/**
 * Модальне вікно підтвердження видалення
 */
export default function ConfirmDeleteModal({ isOpen, title, message, onConfirm, onCancel, isLoading }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Закрити модальне вікно"
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border-2 border-brand-light/30">
        <h3 className="text-lg font-bold text-brand-dark mb-2">{title || 'Підтвердження видалення'}</h3>
        <p className="text-gray-600 mb-6">{message || 'Ви впевнені? Цю дію неможливо скасувати.'}</p>
        
        <div className="flex gap-3 justify-end">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            size="md"
            fullWidth={false}
            className="shadow-none hover:shadow-none"
          >
            Скасувати
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            variant="danger"
            size="md"
            fullWidth={false}
            className="shadow-none hover:shadow-none"
          >
            {isLoading ? 'Видалення...' : 'Видалити'}
          </Button>
        </div>
      </div>
    </div>
  );
}
