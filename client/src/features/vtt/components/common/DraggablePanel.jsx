/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import PropTypes from 'prop-types';
import { X, Lock, Unlock, ChevronUp, ChevronDown } from 'lucide-react';
import useDraggablePanel from '../../hooks/useDraggablePanel';

export default function DraggablePanel({
  isOpen = true,
  onClose,
  title,
  icon,
  children,
  headerContent,
  headerExtra,
  initialState,
  onSaveState,
  storageKey,
  defaultWidth = 400,
  defaultHeight = 500,
  defaultX,
  defaultY,
  minWidth = 300,
  minHeight = 300,
  containerClassName = '',
  containerStyle = {},
  headerClassName = '',
  contentClassName = 'flex flex-col flex-1 overflow-y-auto min-h-0 bg-transparent',
  zIndex = 200,
  resetHeightTrigger,
  openTrigger,
}) {
  const {
    isLocked,
    isCollapsed,
    toggleLock,
    toggleCollapse,
    onDragMouseDown,
    onResizeMouseDown,
    containerRef
  } = useDraggablePanel({
    initialState,
    onSaveState,
    storageKey,
    defaultWidth,
    defaultHeight,
    defaultX: defaultX ?? (globalThis.window ? globalThis.window.innerWidth / 2 - defaultWidth / 2 : 0),
    defaultY: defaultY ?? (globalThis.window ? globalThis.window.innerHeight / 2 - defaultHeight / 2 : 0),
    minWidth,
    minHeight,
    isOpen,
    resetHeightTrigger,
    openTrigger
  });

  if (!isOpen) return null;

  const rh = 'absolute z-50 opacity-0 hover:opacity-100 transition-opacity';

  return (
    <div
      ref={containerRef}
      className={`fixed flex flex-col rounded-xl overflow-hidden will-change-transform border border-brand-light/20 ${containerClassName}`}
      style={{
        zIndex,
        left: 0,
        top: 0,
        background: 'rgba(22, 36, 34, 0.5)',
        backdropFilter: 'blur(24px)',
        ...containerStyle
      }}
    >
      {/* Resize handles */}
      {!isLocked && (
        <>
          {!isCollapsed && (
            <>
              <div onMouseDown={onResizeMouseDown('se')} className={`${rh} bottom-0 right-0 w-4 h-4 cursor-se-resize`} />
              <div onMouseDown={onResizeMouseDown('sw')} className={`${rh} bottom-0 left-0 w-4 h-4 cursor-sw-resize`} />
              <div onMouseDown={onResizeMouseDown('ne')} className={`${rh} top-0 right-0 w-4 h-4 cursor-ne-resize`} />
              <div onMouseDown={onResizeMouseDown('nw')} className={`${rh} top-0 left-0 w-4 h-4 cursor-nw-resize`} />
              <div onMouseDown={onResizeMouseDown('s')}  className={`${rh} left-4 right-4 bottom-0 h-2 cursor-s-resize`} />
              <div onMouseDown={onResizeMouseDown('n')}  className={`${rh} left-4 right-4 top-0 h-2 cursor-n-resize`} />
            </>
          )}
          <div onMouseDown={onResizeMouseDown('e')}  className={`${rh} ${isCollapsed ? 'top-0 bottom-0' : 'top-4 bottom-4'} right-0 w-2 cursor-e-resize`} />
          <div onMouseDown={onResizeMouseDown('w')}  className={`${rh} ${isCollapsed ? 'top-0 bottom-0' : 'top-4 bottom-4'} left-0 w-2 cursor-w-resize`} />
        </>
      )}

      {/* Header */}
      <div 
        onMouseDown={onDragMouseDown}
        className={`flex items-center justify-between px-3 py-2 border-b border-brand-light/10 flex-shrink-0 select-none bg-brand-medium/20 transition-colors duration-300 ${
          isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
        } ${headerClassName}`}
      >
        <div className="flex items-center gap-2 text-brand-light font-bold text-sm tracking-wide flex-1 min-w-0">
          {icon}
          {typeof title === 'string' ? <span className="truncate">{title}</span> : title}
        </div>
        <div className="flex items-center gap-1">
          {headerExtra}
          {headerContent}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleCollapse}
            className="transition-all duration-300 p-1 rounded text-brand-light/70 hover:text-white hover:bg-brand-light/10"
            title={isCollapsed ? 'Розгорнути' : 'Згорнути'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleLock}
            className={`transition-all duration-300 p-1 rounded ${isLocked ? 'text-amber-400 hover:text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] hover:bg-amber-400/10' : 'text-brand-light/70 hover:text-white hover:bg-brand-light/10'}`}
            title={isLocked ? 'Unlock panel' : 'Lock panel'}
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          {onClose && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="text-brand-light/50 hover:text-white transition-colors p-1 rounded hover:bg-brand-light/10"
              title="Close panel"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className={contentClassName}>
          {children}
        </div>
      )}
    </div>
  );
}

DraggablePanel.propTypes = {
  isOpen: PropTypes.bool,
  onClose: PropTypes.func,
  title: PropTypes.node,
  icon: PropTypes.node,
  children: PropTypes.node,
  headerContent: PropTypes.node,
  headerExtra: PropTypes.node,
  initialState: PropTypes.object,
  onSaveState: PropTypes.func,
  storageKey: PropTypes.string,
  defaultWidth: PropTypes.number,
  defaultHeight: PropTypes.number,
  defaultX: PropTypes.number,
  defaultY: PropTypes.number,
  minWidth: PropTypes.number,
  minHeight: PropTypes.number,
  containerClassName: PropTypes.string,
  containerStyle: PropTypes.object,
  headerClassName: PropTypes.string,
  contentClassName: PropTypes.string,
  zIndex: PropTypes.number,
  resetHeightTrigger: PropTypes.any,
  openTrigger: PropTypes.any,
};
