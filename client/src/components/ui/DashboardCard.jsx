import React from 'react';
import PropTypes from 'prop-types';

const DashboardCard = ({ children, className = '', title, actions }) => {
  return (
    // min-h-0 дозволяє flex контейнеру правильно обмежити висоту для скролу
    // overflow-hidden обрізає скролбар по закругленим кутам
    <div className={`bg-white border-2 border-[#9DC88D]/30 rounded-2xl shadow-xl flex flex-col h-auto lg:h-full min-h-0 overflow-hidden ${className}`}>
      {/* Шапка картки (якщо є заголовок або кнопки дій) - фіксована, не скролиться */}
      {(title || actions) && (
        <div className="p-4 border-b border-[#9DC88D]/20 flex justify-between items-center flex-shrink-0">
          {title && <h3 className="text-xl font-bold text-[#164A41]">{title}</h3>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      
      {/* Контент - скролиться окремо */}
      <div className="p-6 flex-1 overflow-y-auto min-h-0">
        {children}
      </div>
    </div>
  );
};

DashboardCard.propTypes = {
  children: PropTypes.node,
  className: PropTypes.string,
  title: PropTypes.node,
  actions: PropTypes.node,
};

export default DashboardCard;