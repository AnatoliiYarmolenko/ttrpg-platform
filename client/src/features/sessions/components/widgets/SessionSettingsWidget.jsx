import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';
import {
  formatDateTimeLocalValue,
  getDateTimeLocalIssue,
  toIsoDateTimeLocalValue,
} from '@/utils/dateTimeLocal';

const DATE_ERROR_MESSAGES = {
  empty: 'Дата сесії обовʼязкова',
  invalid: 'Некоректна дата сесії',
  nonexistent: 'Обраний час не існує у вашому часовому поясі через переведення годинника',
  ambiguous: 'Обраний час повторюється через переведення годинника. Вкажіть іншу годину, щоб уникнути помилки',
  past: 'Дата не може бути в минулому',
};

function buildFormData(session) {
  return {
    title: session?.title || '',
    description: session?.description || '',
    date: formatDateTimeLocalValue(session?.date),
    duration: session?.duration || '',
    maxPlayers: session?.maxPlayers || '',
    system: session?.system || session?.campaign?.system || '',
    visibility: session?.visibility || (session?.campaignId ? 'PRIVATE' : 'PUBLIC'),
    price: session?.price || '',
  };
}

function buildUpdatePayload(session, formData) {
  const initial = buildFormData(session);
  const data = {};

  const normalizedTitle = formData.title.trim();
  if (normalizedTitle !== initial.title.trim()) {
    data.title = normalizedTitle;
  }

  const normalizedDescription = formData.description.trim();
  if (normalizedDescription !== initial.description.trim()) {
    if (normalizedDescription) {
      data.description = normalizedDescription;
    }
  }

  if (formData.date && formData.date !== initial.date) {
    data.date = toIsoDateTimeLocalValue(formData.date);
  }

  if (formData.duration !== '' && String(formData.duration) !== String(initial.duration)) {
    data.duration = Number(formData.duration);
  }

  if (formData.maxPlayers !== '' && String(formData.maxPlayers) !== String(initial.maxPlayers)) {
    data.maxPlayers = Number(formData.maxPlayers);
  }

  if ((formData.system || '') !== (initial.system || '')) {
    data.system = formData.system || null;
  }

  if ((formData.visibility || '') !== (initial.visibility || '')) {
    data.visibility = formData.visibility;
  }

  if (String(formData.price) !== String(initial.price)) {
    if (formData.price !== '') {
      data.price = Number(formData.price);
    }
  }

  return data;
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
  const [dateError, setDateError] = useState('');

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

    if (name === 'date' && dateError) {
      setDateError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const hasDateChanged = formData.date !== buildFormData(session).date;
    if (hasDateChanged) {
      const issue = getDateTimeLocalIssue(formData.date);
      if (issue) {
        setDateError(DATE_ERROR_MESSAGES[issue]);
        return;
      }
    }

    const data = buildUpdatePayload(session, formData);
    if (Object.keys(data).length === 0) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      return;
    }

    try {
      const result = await onSave?.(data);
      if (result?.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch {
      // Mutation errors are handled centrally in the query hooks.
    }
  };

  const handleDelete = () => {
    setDeleteModal(false);
    onDelete?.();
  };

  const inputClasses =
    'w-full p-3 border-2 border-brand-light/50 rounded-xl focus:border-brand-dark outline-none text-brand-dark bg-white transition-colors';

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
            {dateError && (
              <p className="mt-2 text-sm text-red-600">{dateError}</p>
            )}
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
          fullWidth={true}
        >
          Зберегти зміни
        </Button>

        {canDelete && (
          <div className="border-t border-red-200 pt-4 mt-2">
            <h4 className="text-sm font-bold text-red-600 mb-3">Небезпечна зона</h4>
            <Button
              variant="danger"
              onClick={() => setDeleteModal(true)}
              fullWidth={true}
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
