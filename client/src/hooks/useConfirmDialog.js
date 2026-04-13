import { useCallback, useMemo, useState } from 'react';

const INITIAL_STATE = {
  isOpen: false,
  title: '',
  message: '',
  variant: 'primary',
  confirmText: 'Підтвердити',
  cancelText: 'Скасувати',
  isLoading: false,
  onConfirm: null,
};

export default function useConfirmDialog() {
  const [state, setState] = useState(INITIAL_STATE);

  const closeConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const openConfirm = useCallback((config) => {
    setState({
      ...INITIAL_STATE,
      ...config,
      isOpen: true,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    const action = state.onConfirm;
    closeConfirm();
    await action?.();
  }, [closeConfirm, state.onConfirm]);

  const confirmModalProps = useMemo(
    () => ({
      isOpen: state.isOpen,
      title: state.title,
      message: state.message,
      variant: state.variant,
      confirmText: state.confirmText,
      cancelText: state.cancelText,
      isLoading: state.isLoading,
      onConfirm: handleConfirm,
      onCancel: closeConfirm,
    }),
    [
      closeConfirm,
      handleConfirm,
      state.cancelText,
      state.confirmText,
      state.isLoading,
      state.isOpen,
      state.message,
      state.title,
      state.variant,
    ]
  );

  return {
    openConfirm,
    closeConfirm,
    confirmModalProps,
    setConfirmLoading: (isLoading) => {
      setState((prev) => ({ ...prev, isLoading }));
    },
  };
}
