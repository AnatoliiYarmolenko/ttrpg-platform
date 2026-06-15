import PropTypes from 'prop-types';
import Dice20 from '../ui/icons/Dice20';
import Button from '@/components/ui/Button';

export default function EmptyState({
  icon = <Dice20 className="w-10 h-10" />,
  title,
  description,
  action,
  fullHeight = false,
  className = '',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-brand-medium ${fullHeight ? 'h-full' : 'py-8'} ${className}`}>
      {icon && <div className="mb-4">{icon}</div>}
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

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.node,
  description: PropTypes.node,
  action: PropTypes.shape({
    onClick: PropTypes.func,
    label: PropTypes.node,
  }),
  fullHeight: PropTypes.bool,
  className: PropTypes.string,
};
