import React, { useState } from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import { ConfirmModal } from '@/components/shared';
import useConfirmDialog from '@/hooks/useConfirmDialog';
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
    date: formatDateTimeLocalValue(session?.startAt),
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
  canManageSettings = false,
  canManageShareLink = false,
  currentShareLink = '',
  onRegenerateShareLink,
  onCopyShareLink,
  canDelete = true,
  isLoading = false,
  isRegeneratingShareLink = false,
}) {
  const [formData, setFormData] = useState(() => buildFormData(session));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [dateError, setDateError] = useState('');
  const { openConfirm, confirmModalProps } = useConfirmDialog();
  const isReadOnly = !canManageSettings;

  const isCampaignSession = Boolean(session?.campaignId);
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

  const visibilityHelpByValue = isCampaignSession
    ? {
      PRIVATE: 'Звичайна: доступна в межах кампанії за її стандартними правилами.',
      PUBLIC: 'Гостьова: видима користувачам поза кампанією, приєднання через заявку.',
    }
    : {
      PUBLIC: 'Публічна: відображається користувачам, заявки гравців підтверджуються автоматично.',
      PRIVATE: 'За підтвердженням: відображається користувачам, приєднання потребує схвалення.',
      LINK_ONLY: 'За посиланням: не відображається на платформі, доступ лише через secret link.',
    };

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

    if (isReadOnly) {
      return;
    }

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

  const handleRotateShareLink = () => {
    openConfirm({
      title: 'Оновити share-посилання?',
      message: 'Старе share-посилання перестане працювати. Нове посилання буде згенеровано та скопійовано.',
      variant: 'danger',
      confirmText: 'Оновити',
      onConfirm: onRegenerateShareLink,
    });
  };

  const inputClasses =
    'w-full p-3 border-2 border-brand-light/50 rounded-xl focus:border-brand-dark text-brand-dark bg-white transition-colors';

  return (
    <DashboardCard title="Керування сесією">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {isReadOnly && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Ви можете переглядати налаштування, але поточний режим доступу не дозволяє їх змінювати.
          </div>
        )}

        <div className="rounded-xl border border-brand-light/30 bg-brand-light/5 p-4">
          <h3 className="text-sm font-bold text-brand-dark mb-3">Паспорт сесії</h3>

          <div className="flex flex-col gap-4">
            <FormField id="title" label="Назва сесії" required>
              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={inputClasses}
                disabled={isReadOnly}
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
                disabled={isReadOnly}
                rows={3}
                maxLength={2000}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField id="date" label="Дата і час" required>
                <input
                  id="date"
                  type="datetime-local"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={isReadOnly}
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
                  disabled={isReadOnly}
                  min={30}
                  max={480}
                  placeholder="180"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField id="maxPlayers" label="Макс. гравців">
                <input
                  id="maxPlayers"
                  type="number"
                  name="maxPlayers"
                  value={formData.maxPlayers}
                  onChange={handleChange}
                  className={inputClasses}
                  disabled={isReadOnly}
                  min={1}
                  max={20}
                  placeholder="6"
                />
              </FormField>

              <FormField id="system" label="Ігрова система">
                <Dropdown
                  options={[
                    { value: '', label: 'Не вказано' },
                    ...GAME_SYSTEMS.map((system) => ({
                      value: system.value,
                      label: system.label,
                    })),
                  ]}
                  value={formData.system}
                  disabled={isReadOnly}
                  onChange={(option) => {
                    setFormData((prev) => ({ ...prev, system: option.value }));
                    setSaveSuccess(false);
                  }}
                />
              </FormField>
            </div>

            <FormField id="visibility" label={isCampaignSession ? 'Тип сесії' : 'Видимість'}>
              <Dropdown
                options={visibilityOptions}
                value={formData.visibility}
                disabled={isReadOnly}
                onChange={(option) => {
                  setFormData((prev) => ({ ...prev, visibility: option.value }));
                  setSaveSuccess(false);
                }}
              />
            </FormField>
            <p className="mt-1 -mb-3 text-xs text-brand-medium">
              {visibilityHelpByValue[formData.visibility] || 'Оберіть режим доступу до сесії.'}
            </p>

            <FormField id="price" label="Ціна (грн)">
              <input
                id="price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={inputClasses}
                disabled={isReadOnly}
                min={0}
                placeholder="0"
              />
            </FormField>

            {canManageShareLink && (
              <div className="border-t border-brand-light/20 pt-4 flex flex-col gap-2">
                <h4 className="text-sm font-bold text-brand-dark">Share-посилання</h4>

                <div className="p-3 bg-brand-light/20 rounded-xl flex flex-col gap-2">
                  {currentShareLink ? (
                    <code className="px-3 py-2 bg-white rounded-lg font-mono text-brand-dark text-xs break-all">
                      {currentShareLink}
                    </code>
                  ) : (
                    <p className="text-sm text-brand-medium">
                      Share-посилання буде згенероване після натискання кнопки нижче.
                    </p>
                  )}
                </div>

                <div className="grid grid-flow-col auto-cols-fr gap-3 w-full">
                  {currentShareLink && (
                    <Button
                      onClick={onCopyShareLink}
                      variant="outline"
                      fullWidth={true}
                      disabled={isRegeneratingShareLink}
                      className="w-full min-h-[44px] !shadow-none"
                    >
                      Копіювати посилання
                    </Button>
                  )}

                  <Button
                    onClick={handleRotateShareLink}
                    variant="outline"
                    fullWidth={true}
                    disabled={isRegeneratingShareLink}
                    isLoading={isRegeneratingShareLink}
                    loadingText="Оновлення..."
                    className="w-full min-h-[44px] !shadow-none"
                  >
                    {currentShareLink ? 'Оновити share-посилання' : 'Згенерувати share-посилання'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {saveSuccess && (
          <div className="text-sm text-green-600 p-3 bg-green-50 rounded-lg">
            Зміни збережено.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={isReadOnly}
            loadingText="Збереження..."
            fullWidth={true}
            className="w-full min-h-[44px]"
          >
            {isReadOnly ? 'Лише перегляд' : 'Зберегти зміни'}
          </Button>
        </div>

        {canDelete && (
          <div className="border-t border-red-200 pt-4 mt-2 rounded-xl bg-red-50/40 p-4">
            <h4 className="text-sm font-bold text-red-600 mb-3">Небезпечна зона</h4>
            <Button
              variant="danger"
              onClick={() => setDeleteModal(true)}
              fullWidth={true}
              className="w-full min-h-[44px]"
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
          confirmText="Видалити"
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(false)}
        />
      )}

      <ConfirmModal
        {...confirmModalProps}
      />
    </DashboardCard>
  );
}

export default function SessionSettingsWidget(props) {
  const { session } = props;

  if (!session) return null;

  return <SessionSettingsWidgetContent key={session.id ?? 'new-session'} {...props} />;
}

SessionSettingsWidgetContent.propTypes = {
  session: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    description: PropTypes.string,
    startAt: PropTypes.string,
    duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    maxPlayers: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    system: PropTypes.string,
    visibility: PropTypes.string,
    price: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    campaignId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    campaign: PropTypes.shape({
      system: PropTypes.string,
    }),
  }).isRequired,
  onSave: PropTypes.func,
  onDelete: PropTypes.func,
  canManageSettings: PropTypes.bool,
  canManageShareLink: PropTypes.bool,
  currentShareLink: PropTypes.string,
  onRegenerateShareLink: PropTypes.func,
  onCopyShareLink: PropTypes.func,
  canDelete: PropTypes.bool,
  isLoading: PropTypes.bool,
  isRegeneratingShareLink: PropTypes.bool,
};

SessionSettingsWidget.propTypes = {
  session: SessionSettingsWidgetContent.propTypes.session,
  onSave: PropTypes.func,
  onDelete: PropTypes.func,
  canManageSettings: PropTypes.bool,
  canManageShareLink: PropTypes.bool,
  currentShareLink: PropTypes.string,
  onRegenerateShareLink: PropTypes.func,
  onCopyShareLink: PropTypes.func,
  canDelete: PropTypes.bool,
  isLoading: PropTypes.bool,
  isRegeneratingShareLink: PropTypes.bool,
};
