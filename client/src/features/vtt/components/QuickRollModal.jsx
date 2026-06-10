import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Button from '@/components/ui/Button';
import { X, Dices } from 'lucide-react';
import { parseFormula } from '@/features/vtt/utils/diceFormulaEngine';
import DraggablePanel from './common/DraggablePanel';

const diceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

export default function QuickRollModal({
  isOpen,
  onClose,
  onSave,
  onClear,
  initialData,
}) {
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [rollStrength, setRollStrength] = useState(1);
  const [visibility, setVisibility] = useState('PUBLIC');
  const [error, setError] = useState('');

  // Заповнюємо форму при відкритті (асинхронно для запобігання каскадним рендерам)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (initialData) {
          setName(initialData.name || '');
          setFormula(initialData.formula || '');
          setRollStrength(initialData.rollStrength ?? 1);
          setVisibility(initialData.visibility || 'PUBLIC');
        } else {
          setName('');
          setFormula('');
          setRollStrength(1);
          setVisibility('PUBLIC');
        }
        setError('');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialData]);

  const addDice = (dice) => {
    let current = formula.trim().toLowerCase();
    
    if (!current) {
      setFormula(`1${dice}`);
      return;
    }
    
    const regex = new RegExp(String.raw`(^|\+|-) *(\d*) *(${dice})\b`, 'i');
    const match = regex.exec(current);
    
    if (match) {
      const prefix = match[1];
      const countStr = match[2];
      const count = countStr ? Number.parseInt(countStr, 10) : 1;
      const newCount = Math.min(count + 1, 20); // Максимум 20 кубиків одного типу
      
      current = current.replace(regex, `${prefix} ${newCount}${dice}`);
    } else if (!current.endsWith('+') && !current.endsWith('-')) {
      // Якщо рядок не закінчується на + або -, додаємо +
      current += ` + 1${dice}`;
    } else {
      current += ` 1${dice}`;
    }
    
    setFormula(current);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Назва не може бути порожньою.');
      return;
    }
    if (!formula.trim()) {
      setError('Формула не може бути порожньою.');
      return;
    }
    
    const tokens = parseFormula(formula);
    if (tokens.length === 0) {
      setError('Не вдалося розпізнати формулу кидка. Введіть коректні значення (напр. 1d20+5).');
      return;
    }

    let wasModified = false;
    const formattedParts = tokens.map((t, index) => {
      let partStr = '';
      if (t.type === 'dice') {
        let count = t.count;
        if (count > 20) {
          count = 20;
          wasModified = true;
        }
        partStr = `${count}d${t.sides}`;
      } else {
        partStr = `${t.value}`;
      }

      if (index === 0) {
        return t.sign === '-' ? `-${partStr}` : partStr;
      } else {
        return t.sign === '-' ? `- ${partStr}` : `+ ${partStr}`;
      }
    });

    const cleanFormula = formattedParts.join(' ');

    if (wasModified) {
      setFormula(cleanFormula);
      setError('Ліміт 20 кубиків! Значення автоматично виправлено.');
      return;
    }

    onSave({ name: name.trim(), formula: cleanFormula, rollStrength: Number(rollStrength), visibility });
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <DraggablePanel
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Редагувати кидок' : 'Новий швидкий кидок'}
      icon={<Dices size={16} className="text-brand-accent pointer-events-none" />}
      defaultWidth={450}
      defaultHeight={550}
      defaultX={globalThis.window?.innerWidth ? globalThis.window.innerWidth / 2 - 225 : 0}
      defaultY={globalThis.window?.innerHeight ? globalThis.window.innerHeight / 2 - 275 : 0}
      minWidth={420}
      minHeight={500}
      contentClassName="flex-1 flex flex-col min-h-0 bg-transparent text-white"
    >
      <form onSubmit={handleSave} className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <label htmlFor="quick-roll-name" className="block text-sm text-brand-light mb-1 font-semibold">Назва кидка</label>
            <input
              id="quick-roll-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр., Атака мечем"
              className="w-full bg-brand-dark/50 border border-brand-light/20 rounded-lg p-2 text-white placeholder:text-brand-light/30 focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          <div>
            <label htmlFor="quick-roll-formula" className="block text-sm text-brand-light mb-1 font-semibold">Формула</label>
            <div className="w-full bg-brand-dark/50 border border-brand-light/20 rounded-lg p-2 flex items-center gap-2 focus-within:border-brand-accent transition-colors">
              <span className="text-brand-light/50 font-mono">/r</span>
              <input
                id="quick-roll-formula"
                type="text"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="Напр., 1d20+5"
                className="bg-transparent border-none outline-none flex-1 font-mono text-brand-accent placeholder:text-brand-light/30 min-w-0"
              />
              {formula && (
                <button
                  type="button"
                  onClick={() => setFormula('')}
                  className="text-brand-light/50 hover:text-white transition-colors flex-shrink-0"
                  title="Очистити формулу"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            
            <div className="mt-3">
              <div className="text-xs text-brand-light/50 mb-2 uppercase tracking-wider font-semibold">Типи кубиків</div>
              <div className="flex flex-wrap gap-2">
                {diceTypes.map((dice) => (
                  <button
                    key={dice}
                    type="button"
                    onClick={() => addDice(dice)}
                    className="px-3 py-1.5 rounded-md bg-brand-medium/30 hover:bg-brand-medium/70 border border-brand-light/20 transition-colors font-mono text-xs text-brand-light hover:text-white"
                  >
                    {dice}
                  </button>
                ))}
              </div>
            </div>

            {/* Throw Strength Selection */}
            <div className="mt-4 border-t border-brand-light/10 pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-white/50 uppercase tracking-wider font-semibold">Сила кидка</span>
                <span className="text-xs font-mono text-brand-accent">{rollStrength}x</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="3.0" 
                step="0.1" 
                value={rollStrength}
                onChange={(e) => setRollStrength(e.target.value)}
                className="w-full accent-brand-accent"
              />
            </div>

            {/* Visibility Selection */}
            <div className="mt-4 border-t border-brand-light/10 pt-3">
              <div className="text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Видимість</div>
              <select 
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full bg-brand-dark/50 border border-brand-light/20 rounded-md p-2 text-brand-light text-sm focus:border-brand-accent outline-none appearance-none"
              >
                <option value="PUBLIC">Усі бачать цей кидок</option>
                <option value="GM_ONLY">Тільки Майстер (Закритий кидок)</option>
              </select>
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="p-4 border-t border-brand-light/10 flex justify-end gap-3 shrink-0 bg-brand-medium/20">
          {initialData && (
            <Button
              type="button"
              variant="outline"
              className="mr-auto !text-red-400 !border-red-400/50 hover:!bg-red-400/10"
              onClick={handleClear}
            >
              Очистити слот
            </Button>
          )}
          
          <Button type="button" variant="outline" onClick={onClose} className="!text-brand-light !border-brand-light/30 hover:!bg-brand-light/10">
            Скасувати
          </Button>
          
          <Button type="submit" variant="primary" className="!bg-brand-accent !text-brand-dark hover:!bg-brand-accent/90">
            Зберегти
          </Button>
        </div>
      </form>
    </DraggablePanel>
  );
}

QuickRollModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onClear: PropTypes.func.isRequired,
  initialData: PropTypes.shape({
    name: PropTypes.string,
    formula: PropTypes.string,
    rollStrength: PropTypes.number,
    visibility: PropTypes.string,
  }),
};
