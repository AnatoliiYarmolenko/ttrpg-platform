import React, { memo } from 'react';
import PropTypes from 'prop-types';
import Campfire from '../../../../components/ui/icons/Campfire';

const CalendarDayCell = memo(function CalendarDayCell({
  day,
  dateKey,
  count = 0,
  sessions = [],
  isSelected = false,
  isToday = false,
  onSelect,
}) {
  const handleClick = () => {
    if (onSelect && dateKey) {
      onSelect(dateKey);
    }
  };
  const aggregateData = React.useMemo(() => {
    const systemCounts = {};
    const campaignCounts = {};
    
    sessions.forEach(session => {
      if (session.system) {
        systemCounts[session.system] = (systemCounts[session.system] || 0) + 1;
      }
      
      if (session.campaignTitle) {
        campaignCounts[session.campaignTitle] = (campaignCounts[session.campaignTitle] || 0) + 1;
      }
    });
    
    return { systemCounts, campaignCounts };
  }, [sessions]);

  const getSystemColor = (system) => {
    const colors = {
      'D&D 5e': 'bg-red-500',
      'Pathfinder 2e': 'bg-blue-500',
      'Call of Cthulhu': 'bg-purple-500',
      'Інша': 'bg-gray-500',
    };
    return colors[system] || 'bg-green-500';
  };

  const getBorderColor = () => {
    if (isSelected) return 'border-brand-dark';
    if (isToday) return 'border-brand-accent';
    return 'border-gray-200';
  };

  const getBackgroundColor = () => {
    if (isSelected) return 'bg-brand-light/10';
    if (isToday) return 'bg-brand-accent/5';
    return 'bg-white';
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full min-h-[82px]
        flex flex-col items-start justify-between
        rounded-md border
        ${getBorderColor()}
        ${getBackgroundColor()}
        hover:shadow-sm hover:border-brand-dark
        transition-all duration-200
        p-2 relative
      `}
    >
      
      <div className="w-full flex items-center justify-between">
        <div className={`
          text-sm font-medium
          ${isSelected ? 'text-brand-dark font-bold' : 'text-gray-600'}
        `}>
          {day}
        </div>
        
          {count > 0 && (
            <div className={`
              relative group  
              cursor-help     
              flex items-center gap-1
              text-sm font-bold
              ${isSelected ? 'text-brand-dark' : 'text-gray-900'}
            `}>
                <Campfire className="w-3.5 h-3.5" /> {count}

                <div className="
                  absolute bottom-full left-1/2 -translate-x-1/2 mb-1
                  px-2 py-1
                  bg-gray-800 text-white text-xs rounded shadow-lg
                  opacity-0 group-hover:opacity-100 transition-opacity duration-200
                  pointer-events-none whitespace-nowrap z-50
                ">
                  Активні сесії
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                </div>
            </div>
          )}
      </div>

      {count > 0 && (
        <div className="w-full flex flex-col gap-1 mt-auto">
          {Object.entries(aggregateData.systemCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(([system, sysCount]) => (
            <div key={system} className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-hidden flex-1">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSystemColor(system)}`} />
                <span className="text-gray-700 truncate text-[10px] font-medium">{system}</span>
              </div>
              <span className="text-gray-600 font-bold text-[10px] ml-1">{sysCount}</span>
            </div>
          ))}
          
          {Object.keys(aggregateData.systemCounts).length > 2 && (
            <div className="text-[10px] text-gray-500 font-medium">
              +{Object.keys(aggregateData.systemCounts).length - 2}
            </div>
          )}
        </div>
      )}

      {isToday && (
        <div className="absolute top-0.5 right-0.5">
          <div className="w-2 h-2 rounded-full bg-brand-accent"></div>
        </div>
      )}
    </button>
  );
});

export default CalendarDayCell;

CalendarDayCell.propTypes = {
  day: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dateKey: PropTypes.string,
  count: PropTypes.number,
  sessions: PropTypes.array,
  isSelected: PropTypes.bool,
  isToday: PropTypes.bool,
  onSelect: PropTypes.func,
};
