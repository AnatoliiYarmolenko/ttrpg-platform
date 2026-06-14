import useToastStore from '@/stores/useToastStore';
import ToastItem from './ToastItem';

export default function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[1000] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-full sm:max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
