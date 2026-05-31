import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import BaseModal from '@/components/shared/BaseModal';
import Button from '@/components/ui/Button';
import { X } from 'lucide-react';

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
  const [error, setError] = useState('');

  // Заповнюємо форму при відкритті (асинхронно для запобігання каскадним рендерам)
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (initialData) {
          setName(initialData.name || '');
          setFormula(initialData.formula || '');
        } else {
          setName('');
          setFormula('');
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
    
    // Проста валідація формули
    const validFormula = /^[\d\s+\-dD]+$/.exec(formula);
    if (!validFormula) {
      setError('Формула містить недопустимі символи. Використовуйте лише цифри, d, +, -.');
      return;
    }

    onSave({ name: name.trim(), formula: formula.trim().toLowerCase() });
    onClose();
  };

  const handleClear = () => {
    onClear();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="max-w-md w-full"
    >
      <div className="rounded-2xl bg-brand-dark/95 backdrop-blur-md border border-brand-light/20 p-6 shadow-2xl text-white">
        <h3 className="mb-4 text-xl font-bold text-brand-accent">
          {initialData ? 'Редагувати кидок' : 'Новий швидкий кидок'}
        </h3>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label htmlFor="quick-roll-name" className="block text-sm text-brand-light mb-1 font-semibold">Назва кидка</label>
            <input
              id="quick-roll-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр., Атака мечем"
              className="w-full bg-black/20 border border-brand-light/20 rounded-lg p-2 text-white placeholder:text-brand-light/30 focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          <div>
            <label htmlFor="quick-roll-formula" className="block text-sm text-brand-light mb-1 font-semibold">Формула</label>
            <div className="w-full bg-black/20 border border-brand-light/20 rounded-lg p-2 flex items-center gap-2 focus-within:border-brand-accent transition-colors">
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
                  title="Clear formula"
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
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-brand-light/10">
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
      </div>
    </BaseModal>
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
  }),
};
