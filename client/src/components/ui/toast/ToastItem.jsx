import { useCallback, useEffect, useRef, useState } from 'react';
import useToastStore from '@/stores/useToastStore';

const TYPE_STYLES = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-rose-300 bg-rose-50 text-rose-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
};

const EXIT_DURATION = 180;

export default function ToastItem({ toast }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const timeoutRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const isClosingRef = useRef(false);
  const startedAtRef = useRef(0);
  const remainingRef = useRef(Math.max(0, toast.duration ?? 0));
  const [isExiting, setIsExiting] = useState(false);

  const closeToast = useCallback(() => {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    setIsExiting(true);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const prefersReducedMotion =
      globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    if (prefersReducedMotion) {
      removeToast(toast.id);
      return;
    }

    closeTimeoutRef.current = setTimeout(() => {
      removeToast(toast.id);
    }, EXIT_DURATION);
  }, [removeToast, toast.id]);

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) {
      return undefined;
    }

    const schedule = () => {
      startedAtRef.current = Date.now();
      timeoutRef.current = setTimeout(() => {
        closeToast();
      }, remainingRef.current);
    };

    schedule();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [toast.duration, closeToast]);

  const handleMouseEnter = () => {
    if (isClosingRef.current || !toast.duration || toast.duration <= 0 || !timeoutRef.current) {
      return;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    const elapsed = Date.now() - startedAtRef.current;
    remainingRef.current = Math.max(0, remainingRef.current - elapsed);
  };

  const handleMouseLeave = () => {
    if (isClosingRef.current || !toast.duration || toast.duration <= 0 || timeoutRef.current || remainingRef.current <= 0) {
      return;
    }

    startedAtRef.current = Date.now();
    timeoutRef.current = setTimeout(() => {
      closeToast();
    }, remainingRef.current);
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="status"
      aria-live="polite"
      className={`${isExiting ? 'toast-exit' : 'toast-enter'} pointer-events-auto w-full rounded-xl border px-4 py-3 ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {toast.title ? <p className="text-sm font-semibold">{toast.title}</p> : null}
          {toast.message ? <p className="text-sm">{toast.message}</p> : null}
        </div>

        {toast.dismissible ? (
          <button
            type="button"
            onClick={closeToast}
            className="rounded-md px-2 py-1 text-xs font-medium opacity-80 transition-opacity hover:opacity-100"
            aria-label="Закрити сповіщення"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
