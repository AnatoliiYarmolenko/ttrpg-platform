import Button from '@/components/ui/Button';
import Dice20 from '@/components/ui/icons/Dice20';
import PropTypes from 'prop-types';

export default function ErrorScreen({
  message,
  onAction,
  actionLabel = 'На головну',
}) {
  let errorMessage;
  if (message) {
    if (typeof message === 'string') {
      errorMessage = message;
    } else {
      errorMessage = message.message || String(message);
    }
  } else {
    errorMessage = 'Сталася невідома помилка';
  }

  return (
    <div className="min-h-screen bg-brand-dark flex flex-col items-center justify-center text-white">
      <Dice20 className="w-20 h-20 text-brand-accent mb-8" />

      <p className="text-xl font-medium text-white/80 text-center px-6 max-w-sm leading-relaxed mb-8">
        {errorMessage}
      </p>

      {onAction && (
        <Button
          onClick={onAction}
          variant="topbarAccent"
          size="md"
          fullWidth={false}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

ErrorScreen.propTypes = {
  message: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      message: PropTypes.string,
    }),
  ]),
  onAction: PropTypes.func,
  actionLabel: PropTypes.string,
};
