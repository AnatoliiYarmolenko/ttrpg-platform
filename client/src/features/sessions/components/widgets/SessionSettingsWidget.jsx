import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';

function buildFormData(session) {
  return {
    title: session?.title || '',
    description: session?.description || '',
    date: session?.date ? new Date(session.date).toISOString().slice(0, 16) : '',
    duration: session?.duration || '',
    maxPlayers: session?.maxPlayers || '',
    system: session?.system || session?.campaign?.system || '',
    visibility: session?.visibility || (session?.campaignId ? 'PRIVATE' : 'PUBLIC'),
    price: session?.price || '',
  };
}

function SessionSettingsWidgetContent({
  session,
  onSave,
  onDelete,
  canDelete = true,
  isLoading = false,
}) {
  const [formData, setFormData] = useState(() => buildFormData(session));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const isCampaignSession = Boolean(session?.campaignId);
  const visibilityOptions = isCampaignSession
    ? [
        { value: 'PRIVATE', label: 'Звичайна' },
        { value: 'PUBLIC', label: 'Гостьова' },
      ]
    : [
        { value: 'PUBLIC', label: 'Публічна (в календарі, без підтвердження)' },
        { value: 'PRIVATE', label: 'За підтвердженням (в календарі, з підтвердженням)' },
        { value: 'LINK_ONLY', label: 'За посиланням (без календаря, з підтвердженням)' },
      ];

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const data = {};
    if (formData.title.trim()) data.title = formData.title.trim();
    if (formData.description.trim()) data.description = formData.description.trim();
    if (formData.date) data.date = new Date(formData.date).toISOString();
    if (formData.duration) data.duration = Number(formData.duration);
    if (formData.maxPlayers) data.maxPlayers = Number(formData.maxPlayers);
    data.system = formData.system || null;
    data.visibility = formData.visibility;
    if (formData.price !== '') data.price = Number(formData.price);

    const result = await onSave?.(data);
    if (result?.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleDelete = () => {
    setDeleteModal(false);
    onDelete?.();
  };

  const inputClasses =
    'w-full p-3 border-2 border-[#9DC88D]/50 rounded-xl focus:border-[#164A41] outline-none text-[#164A41] bg-white transition-colors';

  return (
    <DashboardCard title="Налаштування сесії">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FormField id="title" label="Назва сесії" required>
          <input
            id="title"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={inputClasses}
            required
            maxLength={100}
          />
        </FormField>

        <FormField id="description" label="Опис">
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className={`${inputClasses} resize-none`}
            rows={3}
            maxLength={2000}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="date" label="Дата і час" required>
            <input
              id="date"
              type="datetime-local"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={inputClasses}
              required
            />
          </FormField>

          <FormField id="duration" label="Тривалість (хв)">
            <input
              id="duration"
              type="number"
              name="duration"
              value={formData.duration}
              onChange={handleChange}
              className={inputClasses}
              min={30}
              max={480}
              placeholder="180"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField id="maxPlayers" label="Макс. гравців">
            <input
              id="maxPlayers"
              type="number"
              name="maxPlayers"
              value={formData.maxPlayers}
              onChange={handleChange}
              className={inputClasses}
              min={1}
              max={20}
              placeholder="6"
            />
          </FormField>

          <FormField id="system" label="Ігрова система">
            <select
              id="system"
              name="system"
              value={formData.system}
              onChange={handleChange}
              className={inputClasses}
            >
              <option value="">Не вказано</option>
              {GAME_SYSTEMS.map((system) => (
                <option key={system.value} value={system.value}>
                  {system.icon} {system.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField id="visibility" label={isCampaignSession ? 'Тип сесії' : 'Видимість'}>
          <select
            id="visibility"
            name="visibility"
            value={formData.visibility}
            onChange={handleChange}
            className={inputClasses}
          >
            {visibilityOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField id="price" label="Ціна (грн)">
          <input
            id="price"
            type="number"
            name="price"
            value={formData.price}
            onChange={handleChange}
            className={inputClasses}
            min={0}
            placeholder="0"
          />
        </FormField>

        {saveSuccess && (
          <div className="text-sm text-green-600 p-3 bg-green-50 rounded-lg">
            Зміни збережено.
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          loadingText="Збереження..."
        >
          Зберегти зміни
        </Button>

        {canDelete && (
          <div className="border-t border-red-200 pt-4 mt-2">
            <h4 className="text-sm font-bold text-red-600 mb-3">Небезпечна зона</h4>
            <Button
              variant="danger"
              onClick={() => setDeleteModal(true)}
            >
              Видалити сесію
            </Button>
          </div>
        )}
      </form>

      {canDelete && (
        <ConfirmModal
          isOpen={deleteModal}
          title="Видалити сесію?"
          message={`Ви впевнені, що хочете видалити сесію "${session.title}"? Цю дію неможливо відмінити.`}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(false)}
        />
      )}
    </DashboardCard>
  );
}

export default function SessionSettingsWidget(props) {
  const { session } = props;

  if (!session) return null;

  return <SessionSettingsWidgetContent key={session.id ?? 'new-session'} {...props} />;
}
