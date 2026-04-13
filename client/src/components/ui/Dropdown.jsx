import React, { useState, useRef, useEffect, useId } from 'react';

const Dropdown = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Оберіть...", 
  label,
  error,
  disabled 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const buttonId = useId();
  const listboxId = useId();

  // Закриття при кліку поза елементом
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    onChange(option);
    setIsOpen(false);
  };

  // Логіка стилів бордюру (ідентична до твого inputClass у формі)
  // Базовий: border-brand-light/30
  // Активний/Відкритий: border-brand-dark
  // Помилка: border-red-300
  let borderClass = "border-brand-light/30";
  
  if (error) {
    borderClass = "border-red-300";
  } else if (isOpen) {
    borderClass = "border-brand-dark"; // Колір фокусу як у твоїх інпутів
  }

  return (
    <div className="w-full relative" ref={dropdownRef}>
      {/* Лейбл як у твоїй формі */}
      {label && (
        <label
          htmlFor={buttonId}
          className="block text-sm font-medium text-brand-dark mb-1 cursor-pointer"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        <button
          id={buttonId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            w-full px-3 py-2 text-left bg-white border-2 rounded-lg 
            flex items-center justify-between
            transition-colors duration-200
            ${borderClass}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-brand-light'}
          `}
        >
          <span className={`block truncate ${!value ? "text-gray-400" : "text-gray-900"}`}>
            {value ? options.find(opt => opt.value === value)?.label : placeholder}
          </span>
          
          {/* SVG стрілочка замість Lucide */}
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            className={`text-brand-dark transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>

        {isOpen && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-50 w-full mt-1 bg-white border border-brand-light rounded-lg shadow-lg max-h-60 overflow-auto py-1"
          >
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option)}
                    className={`
                      w-full px-3 py-2 text-sm text-left cursor-pointer transition-colors
                      ${isSelected
                        ? 'bg-brand-dark/10 text-brand-dark font-medium'
                        : 'text-gray-700 hover:bg-brand-light/20'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-sm text-gray-400 text-center">
                Список порожній
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Повідомлення про помилку (як у твоїй формі) */}
      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}
    </div>
  );
};

export default Dropdown;