import React from 'react';
import useBattlefieldStore from './battlefield/useBattlefieldStore';
import useVttStore from '@/stores/useVttStore';
import DraggablePanel from './common/DraggablePanel';
import { Minus, Triangle, Circle, Square, Ruler } from 'lucide-react';
import PropTypes from 'prop-types';

export default function VttRulerTools({ userId, sceneId, vttConnection }) {
  const isRulerToolsOpen = useVttStore((state) => state.isRulerToolsOpen);
  const toggleRulerTools = useVttStore((state) => state.toggleRulerTools);

  const rulerTool = useBattlefieldStore((state) => state.rulerTool);
  const setRulerTool = useBattlefieldStore((state) => state.setRulerTool);
  
  const rulerConfig = useBattlefieldStore((state) => state.rulerConfig);
  const setRulerConfig = useBattlefieldStore((state) => state.setRulerConfig);

  // Clear ruler local and remote when panel closes
  React.useEffect(() => {
    if (!isRulerToolsOpen && rulerTool) {
      setRulerTool(null);
      useBattlefieldStore.getState().setLocalRuler(null);
      if (sceneId && vttConnection?.sendVttSceneClearRuler) {
        vttConnection.sendVttSceneClearRuler(sceneId, userId);
      }
    }
  }, [isRulerToolsOpen, rulerTool, setRulerTool, sceneId, vttConnection, userId]);

  if (!isRulerToolsOpen) return null;

  const handleConfigChange = (e) => {
    const { name, value } = e.target;
    setRulerConfig({ [name]: Number(value) });
  };

  const tools = [
    { id: 'line', icon: <Minus size={20} />, title: 'Лінія' },
    { id: 'cone', icon: <Triangle size={20} className="rotate-180" />, title: 'Конус' },
    { id: 'circle', icon: <Circle size={20} />, title: 'Коло (Сфера)' },
    { id: 'rectangle', icon: <Square size={20} />, title: 'Прямокутник (Куб)' },
  ];

  const hasConfig = rulerTool && rulerTool !== 'line';
  let dynamicMinHeight = 265;
  if (hasConfig) {
    dynamicMinHeight = rulerTool === 'circle' ? 330 : 360;
  }

  return (
    <DraggablePanel
      title="Лінійка"
      icon={<Ruler size={16} className="text-cyan-400" />}
      onClose={toggleRulerTools}
      storageKey="vtt-ruler-tools-pos-v9"
      initialState={{ x: 20, y: 100 }}
      defaultWidth={288}
      minWidth={260}
      minHeight={dynamicMinHeight}
      resetHeightTrigger={rulerTool}
      className="w-72"
      contentClassName="flex flex-col flex-1 p-3 overflow-hidden"
    >
      <div className="flex flex-col gap-3 flex-1">
        {/* Tools */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setRulerTool(rulerTool === tool.id ? null : tool.id)}
              className={`p-2 rounded flex flex-col items-center justify-center gap-1 transition-colors ${
                rulerTool === tool.id
                  ? 'bg-brand-accent text-white shadow-inner'
                  : 'bg-brand-dark/50 text-brand-light hover:bg-brand-medium hover:text-white'
              }`}
              title={tool.title}
            >
              {tool.icon}
              <span className="text-xs font-medium mt-1 text-center">{tool.title}</span>
            </button>
          ))}
        </div>

        {/* Configurations */}
        {rulerTool && rulerTool !== 'line' && (
          <div className="p-3 bg-brand-dark/50 rounded-lg flex flex-col gap-3 border border-brand-light/10">
            {rulerTool === 'cone' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="coneAngle" className="text-xs text-brand-light">Кут (градуси)</label>
                  <input
                    id="coneAngle"
                    type="number"
                    name="coneAngle"
                    value={rulerConfig.coneAngle}
                    onChange={handleConfigChange}
                    className="bg-brand-dark border border-brand-light/20 rounded px-2 py-1 text-sm text-white w-full"
                    min="1"
                    max="360"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="coneDistance" className="text-xs text-brand-light">Довжина (фути)</label>
                  <input
                    id="coneDistance"
                    type="number"
                    name="distance"
                    value={rulerConfig.distance}
                    onChange={handleConfigChange}
                    className="bg-brand-dark border border-brand-light/20 rounded px-2 py-1 text-sm text-white w-full"
                    min="1"
                  />
                </div>
              </div>
            )}

            {rulerTool === 'circle' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="circleRadius" className="text-xs text-brand-light">Радіус (фути)</label>
                <input
                  id="circleRadius"
                  type="number"
                  name="radius"
                  value={rulerConfig.radius}
                  onChange={handleConfigChange}
                  className="bg-brand-dark border border-brand-light/20 rounded px-2 py-1 text-sm text-white w-full"
                  min="1"
                />
              </div>
            )}

            {rulerTool === 'rectangle' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="rectWidth" className="text-xs text-brand-light">Ширина (фути)</label>
                  <input
                    id="rectWidth"
                    type="number"
                    name="width"
                    value={rulerConfig.width}
                    onChange={handleConfigChange}
                    className="bg-brand-dark border border-brand-light/20 rounded px-2 py-1 text-sm text-white w-full"
                    min="1"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="rectHeight" className="text-xs text-brand-light">Висота (фути)</label>
                  <input
                    id="rectHeight"
                    type="number"
                    name="height"
                    value={rulerConfig.height}
                    onChange={handleConfigChange}
                    className="bg-brand-dark border border-brand-light/20 rounded px-2 py-1 text-sm text-white w-full"
                    min="1"
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {(!rulerTool || rulerTool === 'line') && (
          <div className="text-xs text-brand-light/70 text-center px-2 pb-1">
            Затисніть ліву кнопку миші та тягніть для вимірювання відстані.
          </div>
        )}
      </div>
    </DraggablePanel>
  );
}

VttRulerTools.propTypes = {
  userId: PropTypes.string.isRequired,
  sceneId: PropTypes.string.isRequired,
  vttConnection: PropTypes.shape({
    sendVttSceneClearRuler: PropTypes.func
  }).isRequired
};
