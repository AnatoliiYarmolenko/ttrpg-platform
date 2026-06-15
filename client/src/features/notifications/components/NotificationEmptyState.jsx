import React from 'react';
import PropTypes from 'prop-types';
import EmptyState from '@/components/shared/EmptyState';
import Dice20 from '@/components/ui/icons/Dice20';

const MESSAGES = {
  ACTIVE: {
    title: 'Немає активних сповіщень',
    description: 'Коли щось важливе трапиться, ви побачите це тут',
  },
  ARCHIVED: {
    title: 'Немає архівованих',
    description: "Архівовані сповіщення з'являться тут",
  },
};

export default function NotificationEmptyState({ filter = 'ACTIVE' }) {
  const { title, description } = MESSAGES[filter] || MESSAGES.ACTIVE;
  return (
    <EmptyState
      icon={<Dice20 className="w-10 h-10" />}
      title={title}
      description={description}
    />
  );
}

NotificationEmptyState.propTypes = {
  filter: PropTypes.oneOf(['ACTIVE', 'ARCHIVED']),
};
