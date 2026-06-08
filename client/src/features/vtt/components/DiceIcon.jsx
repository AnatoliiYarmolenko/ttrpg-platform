import React from 'react';
import PropTypes from 'prop-types';

function Wrapper({ children, size, className }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      {children}
    </svg>
  );
}

Wrapper.propTypes = {
  children: PropTypes.node.isRequired,
  size: PropTypes.number,
  className: PropTypes.string,
};

export default function DiceIcon({ label, value, className = "", size = 12 }) {
  // Extract just the 'd<number>' part (e.g., '2d6' -> 'd6')
  const typeMatch = label ? label.toLowerCase().match(/d\d+/) : null;
  const type = typeMatch ? typeMatch[0] : 'd20';

  switch (type) {
    case 'd4':
      return (
        <Wrapper size={size} className={className}>
          <polygon points="12 2 22 20 2 20" />
          <polyline points="2 20 12 10 22 20" />
          <line x1="12" y1="2" x2="12" y2="10" />
        </Wrapper>
      );
    case 'd6':
      return (
        <Wrapper size={size} className={className}>
          <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
          <polyline points="3 7 12 12 21 7" />
          <line x1="12" y1="12" x2="12" y2="22" />
        </Wrapper>
      );
    case 'd8':
      return (
        <Wrapper size={size} className={className}>
          <polygon points="12 2 22 12 12 22 2 12" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <polyline points="12 2 7 12 12 22" />
          <polyline points="12 2 17 12 12 22" />
        </Wrapper>
      );
    case 'd10':
    case 'd100':
      return (
        <Wrapper size={size} className={className}>
          <polygon points="12 2 22 9 12 22 2 9" />
          <polyline points="2 9 7 14 12 9 17 14 22 9" />
          <line x1="12" y1="2" x2="12" y2="9" />
          <line x1="12" y1="22" x2="7" y2="14" />
          <line x1="12" y1="22" x2="17" y2="14" />
        </Wrapper>
      );
    case 'd12':
      return (
        <Wrapper size={size} className={className}>
          <polygon points="12 2 22 9 18 21 6 21 2 9" />
          <polygon points="12 7 16.5 10 14.5 15.5 9.5 15.5 7.5 10" />
          <line x1="12" y1="2" x2="12" y2="7" />
          <line x1="22" y1="9" x2="16.5" y2="10" />
          <line x1="18" y1="21" x2="14.5" y2="15.5" />
          <line x1="6" y1="21" x2="9.5" y2="15.5" />
          <line x1="2" y1="9" x2="7.5" y2="10" />
        </Wrapper>
      );
    case 'd2': {
      let d2Content;
      if (!value) {
        d2Content = <text x="12" y="16" fontSize="11" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">2</text>;
      } else if (value === 2) {
        d2Content = <polyline points="7 12 10.5 15.5 17 8" fill="none" stroke="currentColor" strokeWidth="2.5" />;
      } else {
        d2Content = (
          <g stroke="currentColor" strokeWidth="2.5">
            <line x1="8" y1="8" x2="16" y2="16" />
            <line x1="16" y1="8" x2="8" y2="16" />
          </g>
        );
      }

      return (
        <Wrapper size={size} className={className}>
          <circle cx="12" cy="12" r="10" />
          {d2Content}
        </Wrapper>
      );
    }
    case 'd20':
    default:
      return (
        <Wrapper size={size} className={className}>
          <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />
          <polygon points="7 8 17 8 12 16" />
          <line x1="12" y1="2" x2="7" y2="8" />
          <line x1="12" y1="2" x2="17" y2="8" />
          <line x1="21" y1="7" x2="17" y2="8" />
          <line x1="21" y1="17" x2="17" y2="8" />
          <line x1="21" y1="17" x2="12" y2="16" />
          <line x1="12" y1="22" x2="12" y2="16" />
          <line x1="3" y1="17" x2="12" y2="16" />
          <line x1="3" y1="17" x2="7" y2="8" />
          <line x1="3" y1="7" x2="7" y2="8" />
        </Wrapper>
      );
  }
}

DiceIcon.propTypes = {
  label: PropTypes.string,
  value: PropTypes.number,
  className: PropTypes.string,
  size: PropTypes.number,
};
