import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { 
  MousePointer2, 
  Pencil, 
  Minus, 
  Square, 
  Circle, 
  Hexagon, 
  MoveRight, 
  Type, 
  Undo2, 
  Trash2,
  Settings,
  GripVertical
} from 'lucide-react';
import useBattlefieldStore from './battlefield/useBattlefieldStore';
import useVttStore from '@/stores/useVttStore';
import DraggablePanel from './common/DraggablePanel';

export default function VttDrawingTools({ userId, sceneId, vttConnection }) {
  const drawingTool = useBattlefieldStore(s => s.drawingTool);
  const setDrawingTool = useBattlefieldStore(s => s.setDrawingTool);
  const drawingColor = useBattlefieldStore(s => s.drawingColor);
  const setDrawingColor = useBattlefieldStore(s => s.setDrawingColor);
  const drawingThickness = useBattlefieldStore(s => s.drawingThickness);
  const setDrawingThickness = useBattlefieldStore(s => s.setDrawingThickness);
  
  const { isDrawingToolsOpen, toggleDrawingTools } = useVttStore();

  const [showSettings, setShowSettings] = useState(false);

  const tools = [
    { id: null, icon: MousePointer2, title: 'Вибір / Переміщення' },
    { id: 'pencil', icon: Pencil, title: 'Олівець' },
    { id: 'line', icon: Minus, title: 'Лінія' },
    { id: 'rect', icon: Square, title: 'Прямокутник' },
    { id: 'circle', icon: Circle, title: 'Коло' },
    { id: 'polygon', icon: Hexagon, title: 'Багатокутник' },
    { id: 'arrow', icon: MoveRight, title: 'Стрілочка' },
    { id: 'text', icon: Type, title: 'Текст' },
    { id: 'placeholder', isPlaceholder: true },
    { id: 'settings', icon: Settings, title: 'Налаштування пензля', isAction: true, onClick: () => setShowSettings(true) },
  ];

  const handleUndo = () => {
    if (!sceneId) return;
    vttConnection?.sendVttSceneUndoDrawing?.(sceneId, userId);
  };

  const setClearPromptVisible = useBattlefieldStore(s => s.setClearPromptVisible);

  const handleClearAll = () => {
    if (!sceneId) return;
    setClearPromptVisible(true);
  };

  return (
    <DraggablePanel
      isOpen={isDrawingToolsOpen}
      onClose={toggleDrawingTools}
      title={
        <div className="flex items-center gap-2">
          <Pencil size={16} className="text-brand-accent pointer-events-none" />
          <span className="text-white font-semibold text-sm pointer-events-none">Малюнки</span>
        </div>
      }
      icon={<GripVertical size={14} className="text-brand-light/30 pointer-events-none" />}
      storageKey="vtt_drawingToolsState"
      defaultWidth={260}
      defaultHeight={200}
      defaultX={80}
      defaultY={80}
      minWidth={240}
      minHeight={190}
      contentClassName="flex flex-col flex-1 overflow-visible"
    >
      {/* Main Content Area */}
      {showSettings ? (
        <div className="p-3 space-y-4 flex-1">
          <div className="flex justify-between items-center mb-2 border-b border-brand-light/10 pb-2">
            <span className="text-white font-semibold text-sm">Налаштування пензля</span>
            <button 
              onClick={() => setShowSettings(false)} 
              className="text-brand-light/70 hover:text-white text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
            >
               Готово
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Колір</span>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-brand-light/10 bg-black/40">
              <input 
                type="color" 
                value={drawingColor} 
                onChange={e => setDrawingColor(e.target.value)}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                title="Колір пензля"
              />
              <span className="text-brand-light/80 text-[10px] font-mono uppercase">{drawingColor}</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Товщина ({drawingThickness}px)</span>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={drawingThickness} 
              onChange={e => setDrawingThickness(Number(e.target.value))}
              className="flex-1 max-w-[120px] accent-brand-accent cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <div className="p-2 grid grid-cols-5 gap-1 flex-1">
          {tools.map(tool => {
            if (tool.isPlaceholder) {
              return <div key={tool.id} />;
            }
            if (tool.isAction) {
              return (
                <button
                  key={tool.id}
                  onClick={tool.onClick}
                  title={tool.title}
                  className="flex items-center justify-center p-2 rounded transition-colors border bg-transparent border-brand-light/10 text-brand-light/70 hover:bg-brand-light/5 hover:border-brand-light/30 hover:text-white"
                >
                  <tool.icon size={16} />
                </button>
              );
            }
            const isActive = drawingTool === tool.id;
            const Icon = tool.icon;
            return (
              <button
                key={String(tool.id)}
                onClick={() => setDrawingTool(tool.id)}
                title={tool.title}
                className={`flex items-center justify-center p-2 rounded transition-colors border ${
                  isActive 
                    ? 'bg-brand-accent/30 border-brand-accent text-white shadow-inner' 
                    : 'bg-transparent border-brand-light/10 text-brand-light/70 hover:bg-brand-light/5 hover:border-brand-light/30 hover:text-white'
                }`}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      )}

      {/* Action Buttons */}
      {!showSettings && (
        <div className="px-2 pt-1.5 pb-2 border-t border-brand-light/20 flex gap-2 mt-auto">
          <button 
            onClick={handleUndo}
            className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-brand-dark/50 hover:bg-brand-dark text-brand-light/90 text-sm transition-colors border border-brand-light/20"
            title="Відмінити останню дію"
          >
            <Undo2 size={14} />
            Відмінити
          </button>
          {/* Allow clear all for now or restrict later */}
          <button 
            onClick={handleClearAll}
            className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm transition-colors border border-red-900/50"
            title="Стерти все"
          >
            <Trash2 size={14} />
            Очистити
          </button>
        </div>
      )}
    </DraggablePanel>
  );
}

VttDrawingTools.propTypes = {
  userId: PropTypes.string,
  sceneId: PropTypes.string,
  vttConnection: PropTypes.object,
};
