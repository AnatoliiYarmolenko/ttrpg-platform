import React from 'react';
import { ConfirmModal } from '@/components/shared';

/**
 * Модальне вікно підтвердження видалення
 */
export default function ConfirmDeleteModal({ isOpen, title, message, onConfirm, onCancel, isLoading }) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      title={title || 'Підтвердження видалення'}
      message={message || 'Ви впевнені? Цю дію неможливо скасувати.'}
      confirmText="Видалити"
      cancelText="Скасувати"
      variant="danger"
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
