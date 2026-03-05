import React, { useState } from 'react';
import useSessionStore from '@/features/sessions/store/useSessionStore';
import { GAME_SYSTEMS } from '@/constants/gameSystems';
import Dropdown from '@/components/ui/Dropdown';
import Button from '@/components/ui/Button';

/**
 * Форма створення нової сесії
 * 
 * @param {Object} props
 * @param {string} props.initialDate - Початкова дата (з календаря)
 * @param {number} [props.campaignId] - ID кампанії (для створення сесії в кампанії)
 * @param {Function} props.onSuccess - Callback при успішному створенні
 * @param {Function} props.onCancel - Callback при скасуванні
 */
export default function CreateSessionForm({ initialDate, campaignId, onSuccess, onCancel }) {
  const { createNewSession } = useSessionStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Форматуємо початкову дату для input datetime-local
  const getDefaultDateTime = () => {
    if (initialDate) {
      // Додаємо час 18:00 за замовчуванням
      return `${initialDate}T18:00`;
    }
    // Якщо дата не вибрана — беремо сьогодні + 18:00
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}T18:00`;
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: getDefaultDateTime(),
    duration: 240,
    maxPlayers: 4,
    price: 0,
    visibility: 'PUBLIC',
    system: '',
    isGm: true,
  });

  const [errors, setErrors] = useState({});

  // Валідація форми
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Назва сесії обов\'язкова';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Назва повинна містити мінімум 3 символи';
    }
    
    if (!formData.date) {
      newErrors.date = 'Дата сесії обов\'язкова';
    } else if (new Date(formData.date) < new Date()) {
      newErrors.date = 'Дата не може бути в минулому';
    }
    
    if (formData.duration < 30 || formData.duration > 480) {
      newErrors.duration = 'Тривалість від 30 до 480 хвилин';
    }
    
    if (formData.maxPlayers < 1 || formData.maxPlayers > 20) {
      newErrors.maxPlayers = 'Кількість гравців від 1 до 20';
    }
    
    if (formData.price < 0 || formData.price > 10000) {
      newErrors.price = 'Ціна від 0 до 10000 грн';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Обробник зміни полів
  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
    
    // Очищуємо помилку для цього поля
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Обробник відправки форми
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await createNewSession({
        ...formData,
        date: new Date(formData.date).toISOString(),
        ...(campaignId ? { campaignId: Number(campaignId) } : {}),
      });
      
      if (result.success) {
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Стилі для інпутів
  const inputClass = (fieldName) => `
    w-full px-3 py-2 rounded-lg border-2 
    ${errors[fieldName] 
      ? 'border-red-300 focus:border-red-500' 
      : 'border-[#9DC88D]/30 focus:border-[#164A41]'
    }
    focus:outline-none transition-colors
  `;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Назва */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[#164A41] mb-1">
          Назва сесії *
        </label>
        <input
          id="title"
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Напр: Драконячий хаос"
          className={inputClass('title')}
          maxLength={150}
        />
        {errors.title && (
          <p className="text-red-500 text-xs mt-1">{errors.title}</p>
        )}
      </div>
      
      {/* Опис */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-[#164A41] mb-1">
          Опис
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Коротко опишіть, що чекає гравців..."
          rows={3}
          className={inputClass('description')}
          maxLength={2000}
        />
      </div>
      
      {/* Система */}
      <div>
        <Dropdown
          label="Ігрова система"
          options={GAME_SYSTEMS}
          value={formData.system}
          onChange={(option) => {
            setFormData(prev => ({ ...prev, system: option.value }));
            if (errors.system) {
              setErrors(prev => ({ ...prev, system: null }));
            }
          }}
          placeholder="Оберіть систему"
          error={errors.system}
        />
      </div>

      {/* Роль організатора */}
      <div>
        <p className="block text-sm font-medium text-[#164A41] mb-2">
          Ваша роль у сесії
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, isGm: true }))}
            className={`
              p-3 rounded-xl border-2 text-left transition-colors
              ${formData.isGm
                ? 'border-[#164A41] bg-[#9DC88D]/15 text-[#164A41]'
                : 'border-[#9DC88D]/30 text-[#4D774E] hover:border-[#164A41]/50'}
            `}
          >
            <div className="font-semibold">Я буду GM</div>
            <div className="text-xs mt-1 opacity-80">Керуватиму сесією самостійно</div>
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, isGm: false }))}
            className={`
              p-3 rounded-xl border-2 text-left transition-colors
              ${!formData.isGm
                ? 'border-[#164A41] bg-[#9DC88D]/15 text-[#164A41]'
                : 'border-[#9DC88D]/30 text-[#4D774E] hover:border-[#164A41]/50'}
            `}
          >
            <div className="font-semibold">Шукаю GM</div>
            <div className="text-xs mt-1 opacity-80">Я організатор, GM буде інший</div>
          </button>
        </div>
      </div>
      
      {/* Дата та час */}
      <div>
        <label htmlFor="date" className="block text-sm font-medium text-[#164A41] mb-1">
          Дата і час *
        </label>
        <input
          id="date"
          type="datetime-local"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className={`${inputClass('date')} accent-[#164A41] cursor-pointer`}
        />
        {errors.date && (
          <p className="text-red-500 text-xs mt-1">{errors.date}</p>
        )}
      </div>
      
      {/* Тривалість та Гравці в одному рядку */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Dropdown
            label="Тривалість"
            options={[
              { value: 60, label: '1 година' },
              { value: 90, label: '1.5 години' },
              { value: 120, label: '2 години' },
              { value: 150, label: '2.5 години' },
              { value: 180, label: '3 години' },
              { value: 210, label: '3.5 години' },
              { value: 240, label: '4 години' },
              { value: 300, label: '5 годин' },
              { value: 360, label: '6 годин' },
              { value: 480, label: '8 годин' },
            ]}
            value={formData.duration}
            onChange={(option) => {
              setFormData(prev => ({ ...prev, duration: option.value }));
              if (errors.duration) {
                setErrors(prev => ({ ...prev, duration: null }));
              }
            }}
            error={errors.duration}
          />
        </div>
        
        <div>
          <label htmlFor="maxPlayers" className="block text-sm font-medium text-[#164A41] mb-1">
            Макс. гравців
          </label>
          <input
            id="maxPlayers"
            type="number"
            name="maxPlayers"
            value={formData.maxPlayers}
            onChange={handleChange}
            min={1}
            max={20}
            className={inputClass('maxPlayers')}
          />
          {errors.maxPlayers && (
            <p className="text-red-500 text-xs mt-1">{errors.maxPlayers}</p>
          )}
        </div>
      </div>
      
      {/* Ціна та Видимість */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-[#164A41] mb-1">
            Ціна (грн)
          </label>
          <input
            id="price"
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            min={0}
            max={10000}
            step={100}
            className={inputClass('price')}
          />
          {errors.price && (
            <p className="text-red-500 text-xs mt-1">{errors.price}</p>
          )}
        </div>
        
        <div>
          <Dropdown
            label="Видимість"
            options={[
              { value: 'PUBLIC', label: 'Публічна' },
              { value: 'LINK_ONLY', label: 'За посиланням' },
              { value: 'PRIVATE', label: 'Приватна' },
            ]}
            value={formData.visibility}
            onChange={(option) => {
              setFormData(prev => ({ ...prev, visibility: option.value }));
              if (errors.visibility) {
                setErrors(prev => ({ ...prev, visibility: null }));
              }
            }}
            error={errors.visibility}
          />
        </div>
      </div>
      
      {/* Кнопки */}
      <div className="flex gap-3 mt-4">
        <Button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          variant="outline"
          className="flex-1"
        >
          Скасувати
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          loadingText="Створення..."
          variant="primary"
          className="flex-1"
        >
          Створити
        </Button>
      </div>
    </form>
  );
}
