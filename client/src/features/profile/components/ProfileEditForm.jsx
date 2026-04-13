import React, { useState, useEffect } from 'react';
import { useMyProfileQuery, useProfileMutations } from '../hooks/useProfileQueries';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import { toast } from '@/stores/useToastStore';
import { normalizeTimeZoneValue } from '@/utils/timeZone';

// Список часових поясів для вибору
const TIMEZONES = [
  { value: 'Europe/Kyiv', label: 'Київ (UTC+2/+3)' },
];

// Список мов
const LANGUAGES = [
  { value: 'uk', label: '🇺🇦 Українська' },
];

export default function ProfileEditForm({ onSuccess }) {
  const { data: profile, isLoading } = useMyProfileQuery();
  const { updateProfile } = useProfileMutations();
  const [saving, setSaving] = useState(false);
  
  // Форма
  const [formData, setFormData] = useState({
    displayName: '',
    bio: '',
    timezone: '',
    language: 'uk',
  });
  
  // Заповнення форми даними
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        timezone: normalizeTimeZoneValue(profile.timezone || ''),
        language: profile.language || 'uk',
      });
    }
  }, [profile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Фільтруємо пусті значення
      const dataToSend = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== '' && formData[key] !== null) {
          dataToSend[key] = key === 'timezone'
            ? normalizeTimeZoneValue(formData[key])
            : formData[key];
        }
      });

      const result = await updateProfile(dataToSend);
  toast.success('Профіль успішно оновлено!');
      
      // Викликаємо onSuccess з оновленим профілем
      if (onSuccess && result.profile) {
        onSuccess(result.profile);
      }
    } catch (err) {
      // Підтримуємо новий формат помилок (error замість message)
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Помилка при збереженні';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse text-center py-8 text-brand-medium">
        Завантаження...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ===== Секція: Публічний профіль ===== */}
      <section className="space-y-5">
        <div className="pb-2 border-b border-brand-light/30">
          <h3 className="font-semibold text-brand-dark">Публічний профіль</h3>
          <p className="text-xs text-brand-medium">Інформація, яку бачитимуть інші гравці</p>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-brand-dark mb-2">
            Відображуване ім'я
          </label>
          <input
            id="displayName"
            type="text"
            name="displayName"
            value={formData.displayName}
            onChange={handleChange}
            placeholder="Як вас називати?"
            className="w-full px-4 py-3 rounded-xl border-2 border-brand-light/30 focus:border-brand-dark focus:outline-none transition-colors"
            maxLength={50}
          />
          <p className="text-xs text-brand-medium mt-1">
            Це ім'я бачитимуть інші гравці
          </p>
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-brand-dark mb-2">
            Про себе
          </label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="Розкажіть трохи про себе, свій досвід у НРІ..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border-2 border-brand-light/30 focus:border-brand-dark focus:outline-none transition-colors resize-none"
            maxLength={500}
          />
          <p className="text-xs text-brand-medium mt-1 text-right">
            {formData.bio.length}/500
          </p>
        </div>
      </section>

      {/* ===== Секція: Налаштування ===== */}
      <section className="space-y-5">
        <div className="pb-2 border-b border-brand-light/30">
          <h3 className="font-semibold text-brand-dark">Налаштування</h3>
          <p className="text-xs text-brand-medium">Персональні параметри для зручності використання</p>
        </div>

        {/* Timezone */}
        <div>
          <Dropdown
            label="Часовий пояс"
            options={[{ value: '', label: 'Не вказано' }, ...TIMEZONES]}
            value={formData.timezone}
            onChange={(option) => {
              setFormData(prev => ({ ...prev, timezone: option.value }));
            }}
          />
          <p className="text-xs text-brand-medium mt-1">
            Для правильного планування сесій
          </p>
        </div>

        {/* Language */}
        <div>
          <Dropdown
            label="Мова інтерфейсу"
            options={LANGUAGES}
            value={formData.language}
            onChange={(option) => {
              setFormData(prev => ({ ...prev, language: option.value }));
            }}
          />
        </div>
      </section>

      {/* Submit Button */}
      <div className="pt-4 border-t border-brand-light/20 flex justify-end">
        <Button
          type="submit"
          isLoading={saving}
          loadingText="Збереження..."
          fullWidth={false}
          className="min-w-[220px]"
        >
          Зберегти зміни
        </Button>
      </div>
    </form>
  );
}
