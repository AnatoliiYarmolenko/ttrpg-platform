import React, { useState } from 'react';
import PropTypes from 'prop-types';

const PANELS = { LEFT: 'left', RIGHT: 'right' };

export default function AppLayout({
  topBar,
  leftPanel,
  rightPanel,
  leftLabel = 'Головне',
  rightLabel = 'Деталі',
}) {
  const [activePanel, setActivePanel] = useState(PANELS.LEFT);

  const hasBothPanels = Boolean(leftPanel) && Boolean(rightPanel);
  const showLeft = hasBothPanels ? activePanel === PANELS.LEFT : Boolean(leftPanel);
  const showRight = hasBothPanels ? activePanel === PANELS.RIGHT : Boolean(rightPanel);

  const tabClass = (isActive) =>
    `py-2 rounded-lg text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-white text-brand-dark shadow-sm'
        : 'text-white/70 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="h-dvh bg-brand-dark p-3 lg:p-4 flex flex-col gap-3 relative overflow-hidden">
      <header className="relative z-10 w-full">
        {topBar}
      </header>

      {hasBothPanels && (
        <div className="lg:hidden relative z-10 flex-shrink-0 grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/20 border border-brand-light/10">
          <button
            type="button"
            onClick={() => setActivePanel(PANELS.LEFT)}
            className={tabClass(activePanel === PANELS.LEFT)}
            aria-pressed={activePanel === PANELS.LEFT}
          >
            {leftLabel}
          </button>
          <button
            type="button"
            onClick={() => setActivePanel(PANELS.RIGHT)}
            className={tabClass(activePanel === PANELS.RIGHT)}
            aria-pressed={activePanel === PANELS.RIGHT}
          >
            {rightLabel}
          </button>
        </div>
      )}

      <main className="relative z-10 flex-1 min-h-0 grid grid-cols-1 auto-rows-fr lg:grid-cols-10 gap-3 overflow-hidden">
        <section
          className={`min-h-0 overflow-hidden lg:col-span-7 lg:block ${showLeft ? 'block' : 'hidden'}`}
        >
          {leftPanel}
        </section>

        <aside
          className={`min-h-0 overflow-hidden lg:col-span-3 lg:block ${showRight ? 'block' : 'hidden'}`}
        >
          {rightPanel}
        </aside>
      </main>
    </div>
  );
}

AppLayout.propTypes = {
  topBar: PropTypes.node,
  leftPanel: PropTypes.node,
  rightPanel: PropTypes.node,
  leftLabel: PropTypes.string,
  rightLabel: PropTypes.string,
};
