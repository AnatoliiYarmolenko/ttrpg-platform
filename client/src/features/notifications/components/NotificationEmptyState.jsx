import React from 'react';
import PropTypes from 'prop-types';

/**
 * Empty state для списку сповіщень
 *
 * @param {'all'|'UNREAD'|'ARCHIVED'} filter - поточний фільтр для контекстного повідомлення
 */
export default function NotificationEmptyState({ filter = 'all' }) {
  const messages = {
    all: {
      title: 'Немає сповіщень',
      description: 'Коли щось важливе трапиться, ви побачите це тут',
    },
    UNREAD: {
      title: 'Немає непрочитаних',
      description: 'Всі сповіщення переглянуто, чудова робота!',
    },
    ARCHIVED: {
      title: 'Немає архівованих',
      description: 'Архівовані сповіщення з\'являться тут',
    },
  };

  const { title, description } = messages[filter] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center py-45 text-brand-medium w-full flex-1">
      <p className="text-lg font-medium text-center text-brand-medium">{title}</p>
      <p className="text-sm mt-2 text-center max-w-[250px]">{description}</p>
    </div>
  );
}

NotificationEmptyState.propTypes = {
  filter: PropTypes.oneOf(['all', 'UNREAD', 'ARCHIVED']),
};
