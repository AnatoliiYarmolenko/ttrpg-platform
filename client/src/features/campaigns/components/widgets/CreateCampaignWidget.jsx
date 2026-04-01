import React, { useState } from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import { BackButton } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCampaign } from '@/features/campaigns/api/campaignApi';
import { toast } from '@/stores/useToastStore';

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'За заявкою' },
  { value: 'LINK_ONLY', label: 'За посиланням' },
];

const VISIBILITY_HINTS = {
  PUBLIC: 'Кампанія буде видима в пошуку. Приєднання відбувається після ручного схвалення заявки.',
  LINK_ONLY: 'Кампанія не відображається в пошуку. Доступ відбувається лише через посилання, після схвалення заявки.',
};

const SYSTEM_OPTIONS = [
  { value: '', label: 'Не вказано' },
  ...GAME_SYSTEMS.map((system) => ({
    value: system.value,
    label: system.label,
  })),
];

/**
 * Віджет створення нової кампанії для правого вікна
 * 
 * @param {Object} props
 * @param {Function} props.onSuccess - Callback при успішному створенні (campaign)
 * @param {Function} props.onCancel - Callback при скасуванні
 */
export default function CreateCampaignWidget({ onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: (data) => createCampaign(data),
    onSuccess: () => {
      toast.success('Кампанію успішно створено');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
    onError: (err) => {
      toast.error(err?.response?.data?.error || err?.message || 'Помилка при створенні кампанії');
    },
  });

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    system: '',
    visibility: 'PUBLIC',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Валідація
  const validate = () => {
    const newErrors = {};
    if (!formData.title.trim()) {
      newErrors.title = 'Назва обов\'язкова';
    } else if (formData.title.trim().length < 3) {
      newErrors.title = 'Мінімум 3 символи';
    } else if (formData.title.trim().length > 100) {
      newErrors.title = 'Максимум 100 символів';
    }
    if (formData.description.length > 1000) {
      newErrors.description = 'Максимум 1000 символів';
    }
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstError = Object.values(newErrors)[0];
      if (firstError) {
        toast.error(firstError);
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title.trim(),
        visibility: formData.visibility,
      };
      if (formData.description.trim()) payload.description = formData.description.trim();
      if (formData.system) payload.system = formData.system;

      const result = await createMutation.mutateAsync(payload);

      if (result.success) {
        setFormData({ title: '', description: '', system: '', visibility: 'PUBLIC' });
        setErrors({});
        onSuccess?.(result.data);
      } else if (result.error) {
        toast.error(result.error);
      }
    } catch {
      // toast handled in mutation.onError
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field) =>
    `w-full p-3 border-2 rounded-xl focus:outline-none transition-colors text-[#164A41] bg-white ${
      errors[field]
        ? 'border-red-300 focus:border-red-500'
        : 'border-[#9DC88D]/50 focus:border-[#164A41]'
    }`;

  return (
    <DashboardCard
      title="Нова кампанія"
      actions={<BackButton label="Назад" onClick={onCancel} variant="dark" />}
    >
      <form onSubmit={handleSubmit} className="flex min-h-full flex-col gap-6">
        <section className="space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#164A41] mb-2">
              Назва кампанії <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Наприклад: Загублені копальні"
              className={inputClass('title')}
              maxLength={100}
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#164A41] mb-2">
              Опис
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Коротко опишіть сюжет, тон і очікування від кампанії"
              className={`${inputClass('description')} resize-none`}
              rows={5}
              maxLength={1000}
            />
            {errors.description && (
              <p className="text-xs text-red-500 mt-1">{errors.description}</p>
            )}
            <p className="text-xs text-[#4D774E]/60 mt-1 text-right">
              {formData.description.length}/1000
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Dropdown
              label="Ігрова система"
              options={SYSTEM_OPTIONS}
              value={formData.system}
              onChange={(option) => {
                setFormData((prev) => ({ ...prev, system: option.value }));
                if (errors.system) setErrors((prev) => ({ ...prev, system: null }));
              }}
              placeholder="Оберіть систему"
              error={errors.system}
            />

            <Dropdown
              label="Видимість"
              options={VISIBILITY_OPTIONS}
              value={formData.visibility}
              onChange={(option) => {
                setFormData((prev) => ({ ...prev, visibility: option.value }));
                if (errors.visibility) setErrors((prev) => ({ ...prev, visibility: null }));
              }}
              placeholder="Оберіть видимість"
              error={errors.visibility}
            />
          </div>

          <div className="text-xs text-[#4D774E] bg-[#9DC88D]/10 border border-[#9DC88D]/30 rounded-xl px-4 py-3">
            {VISIBILITY_HINTS[formData.visibility]}
          </div>
        </section>

        <div className="mt-auto border-t border-[#9DC88D]/20 pt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            variant="outline"
            fullWidth={false}
            className="sm:flex-1"
          >
            Скасувати
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            loadingText="Створення..."
            fullWidth={false}
            className="sm:flex-1"
          >
            Створити
          </Button>
        </div>
      </form>
    </DashboardCard>
  );
}

CreateCampaignWidget.propTypes = {
  onSuccess: PropTypes.func,
  onCancel: PropTypes.func,
};
