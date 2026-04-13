import React from 'react';

export default function ParticipantsList({
  items = [],
  onSelect,
  renderItem,
  getItemKey,
  className = 'flex flex-col gap-2',
}) {
  return (
    <div className={className}>
      {items.map((item, index) => {
        const key = getItemKey ? getItemKey(item, index) : item?.id ?? index;

        if (renderItem) {
          return <React.Fragment key={key}>{renderItem(item, index)}</React.Fragment>;
        }

        const label = item?.label || item?.name || `Учасник ${index + 1}`;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(item, index)}
            className="w-full text-left p-3 rounded-xl border-2 border-transparent hover:border-brand-light/50 hover:bg-brand-light/10 transition-all"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}