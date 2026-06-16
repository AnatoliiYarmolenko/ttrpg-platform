import React from 'react';
import PropTypes from 'prop-types';
import { Video, GripVertical } from 'lucide-react';
import useVttStore from '@/stores/useVttStore';
import DraggablePanel from './common/DraggablePanel';
import { CallWidget } from '@/features/call/components/CallWidget';

const MIN_WIDTH = 300;
const MIN_HEIGHT = 350;
const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 500;

export default function VttFloatingCall({ sessionId }) {
  const { isCallOpen, toggleCall } = useVttStore();

  return (
    <DraggablePanel
      isOpen={isCallOpen}
      onClose={toggleCall}
      title={
        <div className="flex items-center gap-2">
          <Video size={16} className="text-brand-accent pointer-events-none" />
          <span className="text-white font-semibold text-sm pointer-events-none">Голосовий зв'язок</span>
        </div>
      }
      icon={<GripVertical size={14} className="text-brand-light/30 pointer-events-none" />}
      storageKey="vtt_floatingCallState"
      defaultWidth={DEFAULT_WIDTH}
      defaultHeight={DEFAULT_HEIGHT}
      defaultX={globalThis.window?.innerWidth ? globalThis.window.innerWidth - DEFAULT_WIDTH - 24 : 0}
      defaultY={globalThis.window?.innerHeight ? 80 : 0}
      minWidth={MIN_WIDTH}
      minHeight={MIN_HEIGHT}
      contentClassName="flex flex-col flex-1 overflow-hidden min-h-0 bg-brand-medium/20"
    >
      <div className="flex-1 flex flex-col min-h-0 px-3 py-2 [&_.bg-gray-100]:!bg-brand-medium/30 [&_.border-gray-200]:!border-brand-light/20 [&_.text-gray-500]:!text-brand-light/70 [&_.text-gray-900]:!text-white overflow-hidden">
        <CallWidget sessionId={sessionId} />
      </div>
    </DraggablePanel>
  );
}

VttFloatingCall.propTypes = {
  sessionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};
