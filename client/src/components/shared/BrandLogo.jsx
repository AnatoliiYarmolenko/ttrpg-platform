import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import Dice20 from '@/components/ui/icons/Dice20';
import Button from '@/components/ui/Button';

export default function BrandLogo({ className = '', isActive = false }) {
  const iconClasses = isActive ? "text-white" : "text-brand-dark";

  return (
    <Button
      as={Link}
      to="/"
      variant={isActive ? 'tabActive' : 'tabInactive'}
      size="md"
      fullWidth={false}
      className={`gap-2 ${className}`}
    >
      <Dice20 className={`w-6 h-6 ${iconClasses}`} />
      <span className="font-bold text-base hidden md:block shrink-0">
        TTRPG Platform
      </span>
    </Button>
  );
}

BrandLogo.propTypes = {
  className: PropTypes.string,
  isActive: PropTypes.bool,
};
