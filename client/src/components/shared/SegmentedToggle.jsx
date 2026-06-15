import React from 'react';
import PropTypes from 'prop-types';

export default function SegmentedToggle({ options, value, onChange, className = '' }) {
  return (
    <div className={`flex gap-1 p-1 bg-brand-light/10 rounded-xl ${className}`}>
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={`
            flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors
            ${value === option.key
              ? 'bg-white text-brand-dark shadow-sm'
              : 'text-brand-medium hover:text-brand-dark hover:bg-brand-light/10'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

SegmentedToggle.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string,
};
