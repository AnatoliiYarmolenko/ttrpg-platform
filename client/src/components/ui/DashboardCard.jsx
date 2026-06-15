import React from 'react';
import PropTypes from 'prop-types';

const DashboardCard = ({ children, className = '', title, actions, noScroll = false }) => {
  return (
    <div className={`bg-white border-2 border-brand-light/30 rounded-2xl shadow-xl flex flex-col h-full min-h-0 overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="p-4 border-b border-brand-light/20 flex flex-wrap justify-between items-center gap-2 flex-shrink-0">
          {title && <h3 className="text-lg sm:text-xl font-bold text-brand-dark">{title}</h3>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      
      <div className={`p-6 flex-1 min-h-0 ${noScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
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
  noScroll: PropTypes.bool,
};

export default DashboardCard;