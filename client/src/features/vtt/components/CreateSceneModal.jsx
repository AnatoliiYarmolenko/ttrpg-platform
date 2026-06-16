import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import DraggablePanel from './common/DraggablePanel';

/**
 * ToggleRow — рядок з перемикачем для функцій-заглушок.
 * Кнопка є, функціонал буде реалізований пізніше.
 *
 * @param {{ label: string }} props
 */
function ToggleRow({ label }) {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="flex items-center gap-3 py-3 px-4 border border-brand-light/10 rounded-lg bg-black/30">
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 ${
          enabled ? 'bg-brand-accent' : 'bg-brand-light/20'
        }`}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="font-semibold text-brand-light text-sm">{label}</span>
      {enabled && (
        <span className="ml-auto text-xs text-brand-accent/70 italic">— незабаром</span>
      )}
    </div>
  );
}

ToggleRow.propTypes = {
  label: PropTypes.string.isRequired,
};

function numToHex(color) {
  if (typeof color === 'number') {
    return '#' + color.toString(16).padStart(6, '0');
  }
  return color;
}

/**
 * CreateSceneModal — розширене модальне вікно для створення нової сцени.
 *
 * Параметри що реалізовані:
 * - Назва сцени
 * - Ширина, Висота, Колір фону
 *
 * Параметри-заглушки (UI є, функціонал — пізніше):
 * - Dynamic Lighting
 * - Grid
 * - Fog of War
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onCreate: (data: { name: string, width: number, height: number, backgroundColor: string }) => void,
 *   onUpdate: (id: string, data: object) => void,
 *   initialData: object,
 * }} props
 */
export default function CreateSceneModal({ isOpen, onClose, onCreate, onUpdate, initialData }) {

  const [name, setName] = useState('');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [backgroundColor, setBackgroundColor] = useState('#3d5a3e');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridType, setGridType] = useState('SQUARE');
  const [gridColor, setGridColor] = useState('#9dc88d');
  const [gridSize, setGridSize] = useState(64);
  const [gridOpacity, setGridOpacity] = useState(0.4);
  const [gridScale, setGridScale] = useState(5);

  // Скидаємо або заповнюємо стан при кожному відкритті
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        console.log('>>> CreateSceneModal initialData:', initialData);
        if (initialData) {
          setName(initialData.name || '');
          setWidth(initialData.width || 1920);
          setHeight(initialData.height || 1080);
          setBackgroundColor(initialData.backgroundColor === undefined ? '#000000' : numToHex(initialData.backgroundColor));
          setGridEnabled(initialData.gridEnabled ?? true);
          setGridType(initialData.gridType || 'SQUARE');
          setGridColor(initialData.gridColor === undefined ? '#39ff14' : numToHex(initialData.gridColor));
          setGridSize(initialData.gridSize || 64);
          setGridOpacity(initialData.gridOpacity || 0.4);
          setGridScale(initialData.gridScale || 5);
        } else {
          setName('');
          setWidth(1920);
          setHeight(1080);
          setBackgroundColor('#000000');
          setGridEnabled(true);
          setGridType('SQUARE');
          setGridColor('#39ff14');
          setGridSize(64);
          setGridOpacity(0.4);
          setGridScale(5);
        }
      }, 0);
    }
  }, [isOpen, initialData]);

  // Автозбереження при редагуванні (Debounce)
  useEffect(() => {
    if (!isOpen || !initialData || !onUpdate) return;

    const parsedWidth = Number(width);
    const parsedHeight = Number(height);

    if (!name.trim() || !Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight)) return;

    const timeoutId = setTimeout(() => {
      onUpdate(initialData.id, {
        name: name.trim(),
        width: parsedWidth,
        height: parsedHeight,
        backgroundColor,
        gridEnabled,
        gridType,
        gridColor,
        gridSize: Number(gridSize),
        gridOpacity: Number(gridOpacity),
        gridScale: Number(gridScale),
      });
      console.log('>>> CreateSceneModal auto-saving with gridScale:', Number(gridScale));
    }, 400); // 400мс затримка щоб не перевантажувати мережу

    return () => clearTimeout(timeoutId);
  }, [
    name, width, height, backgroundColor, gridEnabled, gridType, gridColor, gridSize, gridOpacity, gridScale,
    isOpen, initialData, onUpdate
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const parsedWidth = Number(width);
    const parsedHeight = Number(height);

    if (!name.trim()) return;
    if (!Number.isFinite(parsedWidth) || parsedWidth < 100) return;
    if (!Number.isFinite(parsedHeight) || parsedHeight < 100) return;

    const data = {
      name: name.trim(),
      width: parsedWidth,
      height: parsedHeight,
      backgroundColor,
      gridEnabled,
      gridType,
      gridColor,
      gridSize: Number(gridSize),
      gridOpacity: Number(gridOpacity),
      gridScale: Number(gridScale),
    };

    if (initialData && onUpdate) {
      onUpdate(initialData.id, data);
    } else if (onCreate) {
      onCreate(data);
    }
    
    onClose();
  };

  return (
    <DraggablePanel
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Налаштування сцени" : "Створити сцену"}
      storageKey="vtt_createSceneState"
      defaultWidth={520}
      defaultHeight={580}
      defaultX={globalThis.window?.innerWidth ? globalThis.window.innerWidth / 2 - 260 : 0}
      defaultY={globalThis.window?.innerHeight ? globalThis.window.innerHeight / 2 - 290 : 0}
      minWidth={400}
      minHeight={450}
      zIndex={250}
    >
      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5 overflow-y-auto min-h-0 flex-1">

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sceneName" className="text-xs font-bold text-brand-light/80 uppercase tracking-widest">Назва</label>
            <input
              id="sceneName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Назва сцени..."
              maxLength={100}
              required
              className="w-full px-3 py-2.5 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 border border-brand-light/10 hover:border-brand-light/30 transition-colors"
              style={{ background: 'rgba(0,0,0,0.35)' }}
            />
          </div>

          {/* Width / Height / Color */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[100px]">
              <label htmlFor="sceneWidth" className="text-sm font-semibold text-brand-light/70 whitespace-nowrap">Ширина</label>
              <input
                id="sceneWidth"
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min="100"
                max="10000"
                required
                className="flex-1 px-2.5 py-2 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 border border-brand-light/10 hover:border-brand-light/30 transition-colors w-full"
                style={{ background: 'rgba(0,0,0,0.35)' }}
              />
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[100px]">
              <label htmlFor="sceneHeight" className="text-sm font-semibold text-brand-light/70 whitespace-nowrap">Висота</label>
              <input
                id="sceneHeight"
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min="100"
                max="10000"
                required
                className="flex-1 px-2.5 py-2 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50 border border-brand-light/10 hover:border-brand-light/30 transition-colors w-full"
                style={{ background: 'rgba(0,0,0,0.35)' }}
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sceneColor" className="text-sm font-semibold text-brand-light/70 whitespace-nowrap">Колір</label>
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-brand-light/10" style={{ background: 'rgba(0,0,0,0.35)' }}>
                <input
                  id="sceneColor"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  title="Колір фону"
                />
                <span className="text-brand-light/80 text-xs font-mono uppercase">{backgroundColor}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-brand-light/10 my-1" />

          {/* Feature Toggles (stubs and active Grid) */}
          <div className="flex flex-col gap-2">
            <ToggleRow label="Динамічне освітлення" />
            
            {/* Active Grid Control */}
            <div className="flex flex-col gap-2 py-3 px-4 border border-brand-light/10 rounded-lg bg-black/30">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setGridEnabled((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 ${
                    gridEnabled ? 'bg-brand-accent' : 'bg-brand-light/20'
                  }`}
                  aria-label="Перемкнути сітку"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      gridEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="font-semibold text-brand-light text-sm">Сітка</span>
              </div>

              {gridEnabled && (
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-brand-light/5 flex-wrap">
                  {/* Grid Type */}
                  <div className="flex items-center gap-2 flex-1 min-w-[140px]">
                    <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Тип</span>
                    <select
                      value={gridType}
                      onChange={(e) => setGridType(e.target.value)}
                      className="flex-1 bg-black/40 text-white text-xs rounded-lg px-2 py-1 border border-brand-light/10 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 cursor-pointer"
                    >
                      <option value="SQUARE" className="bg-brand-dark">Квадратна</option>
                      <option value="HEXAGONAL" className="bg-brand-dark">Гексагональна</option>
                    </select>
                  </div>

                  {/* Grid Color */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Колір</span>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-brand-light/10 bg-black/40">
                      <input
                        type="color"
                        value={gridColor}
                        onChange={(e) => setGridColor(e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                        title="Колір сітки"
                      />
                      <span className="text-brand-light/80 text-[10px] font-mono uppercase">{gridColor}</span>
                    </div>
                  </div>

                  {/* Grid Opacity */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Прозорість</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={gridOpacity}
                      onChange={(e) => setGridOpacity(Number(e.target.value))}
                      className="w-20 accent-brand-accent cursor-pointer"
                      title={`${Math.round(gridOpacity * 100)}%`}
                    />
                  </div>

                  {/* Grid Size */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Розмір</span>
                    <input
                      type="number"
                      value={gridSize}
                      onChange={(e) => setGridSize(Number(e.target.value))}
                      min="10"
                      max="500"
                      className="w-14 bg-black/40 text-white text-xs rounded-lg px-2 py-1 border border-brand-light/10 focus:outline-none focus:ring-1 focus:ring-brand-accent/50"
                    />
                  </div>

                  {/* Grid Scale */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-brand-light/70 whitespace-nowrap">Фут. еквівалент</span>
                    <select
                      value={gridScale}
                      onChange={(e) => setGridScale(Number(e.target.value))}
                      className="bg-black/40 text-white text-xs rounded-lg px-2 py-1 border border-brand-light/10 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 cursor-pointer"
                    >
                      <option value="5" className="bg-brand-dark">5</option>
                      <option value="7.5" className="bg-brand-dark">7.5</option>
                      <option value="10" className="bg-brand-dark">10</option>
                      <option value="15" className="bg-brand-dark">15</option>
                      <option value="30" className="bg-brand-dark">30</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <ToggleRow label="Туман війни" />
          </div>

          {/* Divider */}
          <div className="border-t border-brand-light/10 my-1" />

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-brand-light/70 hover:text-white hover:bg-brand-medium/20 transition-colors text-sm font-medium"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2 rounded-lg bg-brand-accent text-brand-dark font-bold text-sm hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {initialData ? 'Зберегти' : 'Створити сцену'}
            </button>
          </div>
      </form>
    </DraggablePanel>
  );
}

CreateSceneModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func,
  onUpdate: PropTypes.func,
  initialData: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    width: PropTypes.number,
    height: PropTypes.number,
    backgroundColor: PropTypes.string,
    gridEnabled: PropTypes.bool,
    gridType: PropTypes.string,
    gridColor: PropTypes.string,
    gridSize: PropTypes.number,
    gridOpacity: PropTypes.number,
    gridScale: PropTypes.number,
  }),
};
