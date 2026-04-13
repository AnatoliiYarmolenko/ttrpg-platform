import Dice20 from '../ui/icons/Dice20';
import Button from '@/components/ui/Button';

/**
 * Заглушка "немає даних" — уніфікований порожній стан.
 *
 * Використання:
 *   <EmptyState
 *     icon={<Dice20 className="w-10 h-10" />}
 *     title="Немає запланованих сесій"
 *     description="на цей день"
 *     action={{ label: '+ Створити сесію', onClick: handleCreate }}
 *   />
 *
 * @param {React.ReactNode} icon — іконка/компонент
 * @param {string} title — основний текст
 * @param {string} [description] — додатковий підтекст
 * @param {{ label: string, onClick: Function }} [action] — опціональна CTA-кнопка
 */
export default function EmptyState({
  icon = <Dice20 className="w-10 h-10" />,
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 text-brand-medium ${className}`}>
      <div className="mb-4">{icon}</div>
      {title && <p className="text-lg font-medium text-center">{title}</p>}
      {description && <p className="text-sm mt-2 text-center">{description}</p>}
      {action && (
        <Button
          type="button"
          onClick={action.onClick}
          variant="secondary"
          fullWidth={false}
          className="mt-4"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
