import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession } from '@/features/sessions/api/sessionApi';
import { GAME_SYSTEMS } from '@/constants/gameSystems';
import Dropdown from '@/components/ui/Dropdown';
import Button from '@/components/ui/Button';
import { toast } from '@/stores/useToastStore';
import { getDateTimeLocalIssue, toIsoDateTimeLocalValue } from '@/utils/dateTimeLocal';

const DATE_ERROR_MESSAGES = {
  empty: 'Дата сесії обовʼязкова',
  invalid: 'Некоректна дата сесії',
  nonexistent: 'Обраний час не існує у вашому часовому поясі через переведення годинника',
  ambiguous: 'Обраний час повторюється через переведення годинника. Вкажіть іншу годину, щоб уникнути помилки',
  past: 'Дата не може бути в минулому',
};

export default function CreateSessionForm({
  initialDate,
  campaignId,
  requireGmRole = false,
  onSuccess,
  onCancel,
}) {
  const queryClient = useQueryClient();
  const isCampaignSession = Boolean(campaignId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data) => createSession(data),
    onSuccess: () => {
      toast.success('Сесію успішно створено');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'games'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      if (campaignId) {
        queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
      }
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.message || 'Помилка при створенні сесії');
    },
  });

  const getDefaultDateTime = () => {
    if (initialDate) {
      return `${initialDate}T18:00`;
    }

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
    visibility: isCampaignSession ? 'PRIVATE' : 'PUBLIC',
    system: '',
    isGm: true,
  });
  const [errors, setErrors] = useState({});

  const visibilityOptions = isCampaignSession
    ? [
        { value: 'PRIVATE', label: 'Звичайна' },
        { value: 'PUBLIC', label: 'Гостьова' },
      ]
    : [
        { value: 'PUBLIC', label: 'Публічна' },
        { value: 'PRIVATE', label: 'За підтвердженням' },
        { value: 'LINK_ONLY', label: 'За посиланням' },
      ];

  const visibilityHint = isCampaignSession
    ? {
        PRIVATE: 'Звичайна: доступна в межах кампанії за її стандартними правилами.',
        PUBLIC: 'Гостьова: видима користувачам поза кампанією, приєднання через заявку.',
      }[formData.visibility]
    : {
        PUBLIC: 'Публічна: відображається користувачам, заявки гравців підтверджуються автоматично.',
        PRIVATE: 'За підтвердженням: відображається користувачам, приєднання потребує схвалення.',
        LINK_ONLY: 'За посиланням: не відображається на платформі, доступ лише через secret link.',
      }[formData.visibility];

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.title.trim()) {
      nextErrors.title = 'Назва сесії обовʼязкова';
    } else if (formData.title.trim().length < 3) {
      nextErrors.title = 'Назва повинна містити мінімум 3 символи';
    }

    const dateIssue = getDateTimeLocalIssue(formData.date);
    if (dateIssue) {
      nextErrors.date = DATE_ERROR_MESSAGES[dateIssue];
    }

    if (formData.duration < 30 || formData.duration > 480) {
      nextErrors.duration = 'Тривалість від 30 до 480 хвилин';
    }

    if (formData.maxPlayers < 1 || formData.maxPlayers > 20) {
      nextErrors.maxPlayers = 'Кількість гравців від 1 до 20';
    }

    if (formData.price < 0 || formData.price > 10000) {
      nextErrors.price = 'Ціна від 0 до 10000 грн';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const firstError = Object.values(nextErrors)[0];
      if (firstError) {
        toast.error(firstError);
      }
    }

    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value, type } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number.parseFloat(value) || 0 : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const sessionDateIso = toIsoDateTimeLocalValue(formData.date);
      if (!sessionDateIso) {
        const dateError = DATE_ERROR_MESSAGES[getDateTimeLocalIssue(formData.date) || 'invalid'];
        setErrors((prev) => ({ ...prev, date: dateError }));
        toast.error(dateError);
        return;
      }

      const payload = {
        title: formData.title.trim(),
        date: sessionDateIso,
        duration: formData.duration,
        maxPlayers: formData.maxPlayers,
        price: formData.price,
        visibility: formData.visibility,
        isGm: requireGmRole ? true : formData.isGm,
        ...(campaignId ? { campaignId: Number(campaignId) } : {}),
      };

      if (formData.description.trim()) {
        payload.description = formData.description.trim();
      }

      if (formData.system) {
        payload.system = formData.system;
      }

      const result = await createMutation.mutateAsync(payload);

      if (result.success) {
        onSuccess?.();
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch {
      // toast handled in mutation.onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (fieldName) => `
    w-full px-3 py-2 rounded-lg border-2
    ${errors[fieldName]
      ? 'border-red-300 focus:border-red-500'
      : 'border-brand-light/30 focus:border-brand-dark'}
    transition-colors
  `;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-brand-dark mb-1">
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
        {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-brand-dark mb-1">
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

      <div>
        <Dropdown
          label="Ігрова система"
          options={GAME_SYSTEMS}
          value={formData.system}
          onChange={(option) => {
            setFormData((prev) => ({ ...prev, system: option.value }));
            if (errors.system) {
              setErrors((prev) => ({ ...prev, system: null }));
            }
          }}
          placeholder="Оберіть систему"
          error={errors.system}
        />
      </div>

      {!requireGmRole && (
        <div>
          <p className="block text-sm font-medium text-brand-dark mb-2">
            Ваша роль у сесії
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, isGm: true }))}
                className={`
                  w-full p-3 rounded-xl border-2 text-left transition-all shadow-none hover:shadow-none
                ${formData.isGm
                    ? 'border-brand-dark bg-brand-light/15 text-brand-dark'
                    : 'border-brand-light/30 text-brand-medium hover:border-brand-dark/50 hover:bg-brand-light/10'}
              `}
            >
              <div className="font-semibold">Я буду Майстром</div>
              <div className="text-xs mt-1 opacity-80">Керуватиму сесією самостійно</div>
              </button>
              <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, isGm: false }))}
                className={`
                  w-full p-3 rounded-xl border-2 text-left transition-all shadow-none hover:shadow-none
                  ${formData.isGm
                    ? 'border-brand-light/30 text-brand-medium hover:border-brand-dark/50 hover:bg-brand-light/10'
                    : 'border-brand-dark bg-brand-light/15 text-brand-dark'}
              `}
            >
              <div className="font-semibold">Шукаю Майстра</div>
              <div className="text-xs mt-1 opacity-80">Я організатор, Майстром буде інший</div>
              </button>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="date" className="block text-sm font-medium text-brand-dark mb-1">
          Дата і час *
        </label>
        <input
          id="date"
          type="datetime-local"
          name="date"
          value={formData.date}
          onChange={handleChange}
          className={`${inputClass('date')} accent-brand-dark cursor-pointer`}
        />
        {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
      </div>

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
              setFormData((prev) => ({ ...prev, duration: option.value }));
              if (errors.duration) {
                setErrors((prev) => ({ ...prev, duration: null }));
              }
            }}
            error={errors.duration}
          />
        </div>

        <div>
          <label htmlFor="maxPlayers" className="block text-sm font-medium text-brand-dark mb-1">
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
          {errors.maxPlayers && <p className="text-red-500 text-xs mt-1">{errors.maxPlayers}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="price" className="block text-sm font-medium text-brand-dark mb-1">
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
          {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price}</p>}
        </div>

        <div>
          <Dropdown
            label={isCampaignSession ? 'Тип сесії' : 'Видимість'}
            options={visibilityOptions}
            value={formData.visibility}
            onChange={(option) => {
              setFormData((prev) => ({ ...prev, visibility: option.value }));
              if (errors.visibility) {
                setErrors((prev) => ({ ...prev, visibility: null }));
              }
            }}
            error={errors.visibility}
          />
        </div>
      </div>

      <div className="text-xs text-brand-medium bg-brand-light/10 border border-brand-light/30 rounded-lg px-3 py-2">
        {visibilityHint}
      </div>

      <div className="flex gap-3 mt-4">
        {onCancel && (
          <Button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            variant="outline"
            fullWidth={true}
            className="flex-1"
          >
            Скасувати
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting}
          isLoading={isSubmitting}
          loadingText="Створення..."
          variant="primary"
          fullWidth={true}
          className={onCancel ? 'flex-1' : 'w-full'}
        >
          Створити
        </Button>
      </div>
    </form>
  );
}
