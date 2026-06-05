import React, { useState } from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import { ConfirmModal, StatusBadge } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';
import useConfirmDialog from '@/hooks/useConfirmDialog';

const normalizeVisibility = (value) => (value === 'PRIVATE' ? 'LINK_ONLY' : value);

function buildFormData(campaign) {
  return {
    title: campaign?.title || '',
    description: campaign?.description || '',
    system: campaign?.system || '',
    visibility: normalizeVisibility(campaign?.visibility || 'PUBLIC'),
  };
}

function buildUpdatePayload(campaign, formData) {
  const initial = buildFormData(campaign);
  const data = {};

  const normalizedTitle = formData.title.trim();
  if (normalizedTitle !== initial.title.trim()) {
    data.title = normalizedTitle;
  }

  const normalizedDescription = formData.description.trim();
  if (normalizedDescription !== initial.description.trim()) {
    data.description = normalizedDescription;
  }

  if ((formData.system || '') !== (initial.system || '')) {
    data.system = formData.system || '';
  }

  if (formData.visibility !== initial.visibility) {
    data.visibility = normalizeVisibility(formData.visibility);
  }

  return data;
}

function CampaignSettingsWidgetContent({
  campaign,
  onSave,
  onTransferOwnership,
  onLeave,
  canTransferOwnership = false,
  canManageShareLink = false,
  currentShareLink = '',
  onRegenerateShareLink,
  onCopyShareLink,
  myRole,
  isLoading = false,
  isRegeneratingShareLink = false,
}) {
  const [formData, setFormData] = useState(() => buildFormData(campaign));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');

  const isCampaignFinished = campaign?.status === 'FINISHED';
  const controlsDisabled = isLoading || isCampaignFinished;

  const visibilityOptions = [
    { value: 'PUBLIC', label: 'За заявкою' },
    { value: 'LINK_ONLY', label: 'За посиланням' },
  ];

  const visibilityHelpByValue = {
    PUBLIC: 'За заявкою: кампанія відображатиметься в глобальному пошуку і до неї зможуть подавати заявку.',
    LINK_ONLY: 'За посиланням: не відображатиметься у глобальному пошуку, доступ лише за посиланням.',
  };

  const eligibleNewOwners = (campaign?.members || [])
    .filter((member) => member.userId !== campaign.ownerId)
    .filter((member, index, array) => array.findIndex((item) => item.userId === member.userId) === index);

  const selectedOwner = eligibleNewOwners.find(
    (member) => String(member.userId) === String(selectedNewOwnerId)
  );
  const selectedOwnerName = selectedOwner
    ? (selectedOwner.user?.displayName || selectedOwner.user?.username || `User #${selectedOwner.userId}`)
    : '';

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isCampaignFinished) return;

    const data = buildUpdatePayload(campaign, formData);
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

  const handleFinishCampaign = async () => {
    setFinishModal(false);

    if (isCampaignFinished) return;

    const result = await onSave?.({ status: 'FINISHED' });
    if (result?.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleTransferOwnership = async () => {
    if (!canTransferOwnership || !selectedNewOwnerId || isCampaignFinished) return;

    const result = await onTransferOwnership?.(Number(selectedNewOwnerId));
    if (result?.success) {
      setTransferModal(false);
      setSelectedNewOwnerId('');
    }
  };

  const { openConfirm, confirmModalProps: leaveConfirmProps } = useConfirmDialog();

  const handleLeave = () => {
    openConfirm({
      title: 'Покинути кампанію?',
      message: 'Ви впевнені, що хочете покинути цю кампанію? Ви втратите доступ до всіх сесій цієї кампанії.',
      variant: 'danger',
      confirmText: 'Вийти',
      onConfirm: onLeave,
    });
  };

  const handleRegenerateShareLink = () => {
    openConfirm({
      title: 'Оновити share-посилання?',
      message: 'Старе share-посилання перестане працювати. Нове посилання буде згенеровано та скопійовано.',
      variant: 'danger',
      confirmText: 'Оновити',
      onConfirm: onRegenerateShareLink,
    });
  };

  const inputClasses =
    'w-full p-3 border-2 border-brand-light/50 rounded-xl focus:border-brand-dark text-brand-dark bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <DashboardCard title="Налаштування кампанії">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="rounded-xl border border-brand-light/30 bg-brand-light/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-brand-dark">Паспорт кампанії</h3>
            <StatusBadge status={campaign.status || 'ACTIVE'} size="sm" />
          </div>

          <div className="flex flex-col gap-4">
            <FormField id="title" label="Назва кампанії" required>
              <input
                id="title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={inputClasses}
                required
                maxLength={100}
                disabled={controlsDisabled}
              />
            </FormField>

            <FormField id="description" label="Опис">
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={`${inputClasses} resize-none`}
                rows={4}
                maxLength={2000}
                placeholder="Опишіть вашу кампанію..."
                disabled={controlsDisabled}
              />
            </FormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField id="system" label="Ігрова система">
                <Dropdown
                  options={[
                    {
                      value: '',
                      label: 'Не вказано',
                    },
                    ...GAME_SYSTEMS.map((system) => ({
                      value: system.value,
                      label: system.label,
                    })),
                  ]}
                  value={formData.system}
                  onChange={(option) => {
                    setFormData((prev) => ({ ...prev, system: option.value }));
                    setSaveSuccess(false);
                  }}
                  disabled={controlsDisabled}
                />
              </FormField>

              <div>
                <FormField id="visibility" label="Видимість">
                  <Dropdown
                    options={visibilityOptions}
                    value={formData.visibility}
                    onChange={(option) => {
                      setFormData((prev) => ({ ...prev, visibility: option.value }));
                      setSaveSuccess(false);
                    }}
                    disabled={controlsDisabled}
                  />
                </FormField>
                <p className="mt-1 flex text-xs text-brand-medium">
                  {visibilityHelpByValue[formData.visibility] || 'Оберіть режим доступу до кампанії.'}
                </p>
              </div>
            </div>

            {canManageShareLink && (
              <div className="border-t border-brand-light/20 pt-4 flex flex-col gap-2 mt-2">
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
                    onClick={handleRegenerateShareLink}
                    variant="outline"
                    fullWidth={true}
                    disabled={isRegeneratingShareLink}
                    isLoading={isRegeneratingShareLink}
                    loadingText="╨Ю╨╜╨╛╨▓╨╗╨╡╨╜╨╜╤П..."
                    className="w-full min-h-[44px] !shadow-none"
                  >
                    {currentShareLink ? 'Оновити share-посилання' : 'Згенерувати share-посилання'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {isCampaignFinished && (
          <div className="text-sm text-amber-700 p-3 bg-amber-50 rounded-lg border border-amber-200">
            Кампанія завершена. Налаштування заблоковані, нові сесії та вступ недоступні.
          </div>
        )}

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
            loadingText="Збереження..."
            disabled={controlsDisabled}
            fullWidth={true}
            className="w-full min-h-[44px]"
          >
            Зберегти зміни
          </Button>
        </div>

        {myRole && myRole !== 'OWNER' && !isCampaignFinished && onLeave && (
          <div className="mt-2">
            <Button
              onClick={handleLeave}
              variant="danger"
              isLoading={isLoading}
              loadingText="Вихід..."
              fullWidth={true}
              className="w-full min-h-[44px]"
            >
              Покинути кампанію
            </Button>
          </div>
        )}

        {canTransferOwnership && (
          <div className="border-t border-red-200 pt-4 mt-2 rounded-xl bg-red-50/40 p-4">
            <h4 className="text-sm font-bold text-red-600 mb-3">Небезпечна зона</h4>

            {!isCampaignFinished && (
              <div className="mb-4">
                <Button
                  variant="danger"
                  disabled={isLoading}
                  onClick={() => setFinishModal(true)}
                  fullWidth={true}
                  className="w-full min-h-[44px]"
                >
                  Завершити кампанію
                </Button>
                <p className="text-xs text-red-600/80 mt-2 text-center">
                  Після завершення кампанії не можна буде додавати нові сесії або приєднуватися до них.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-red-200">
              <p className="text-sm font-medium text-red-600 mb-2">Передача прав власності</p>
              <p className="text-xs text-red-600/80 mb-3">
                Передача прав власності змінить власника. Ви станете звичайним учасником цієї кампанії.
              </p>

              {eligibleNewOwners.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <Dropdown
                    options={[
                      { value: '', label: 'Оберіть нового власника' },
                      ...eligibleNewOwners.map((member) => ({
                        value: String(member.userId),
                        label: member.user?.displayName || member.user?.username || `User #${member.userId}`,
                      }))
                    ]}
                    value={selectedNewOwnerId}
                    onChange={(option) => setSelectedNewOwnerId(option.value)}
                    disabled={isCampaignFinished}
                  />

                  <Button
                    variant="danger"
                    disabled={!selectedNewOwnerId || isLoading || isCampaignFinished}
                    onClick={() => setTransferModal(true)}
                    fullWidth={true}
                    className="w-full min-h-[44px] !bg-red-600 hover:!bg-red-700 text-white border-transparent"
                  >
                    Передати права кампанії
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-red-600/80 font-medium">Немає ліквідних учасників для передачі прав.</p>
              )}
            </div>
          </div>
        )}
      </form>

      <ConfirmModal
        isOpen={finishModal}
        title="Завершити кампанію?"
        message="Після підтвердження кампанія стане завершеною. Додавання сесій, вступ і зміна налаштувань будуть заблоковані. Цю дію не можна скасувати."
        variant="danger"
        confirmText="Завершити"
        onConfirm={handleFinishCampaign}
        onCancel={() => setFinishModal(false)}
      />

      {canTransferOwnership && (
        <ConfirmModal
          isOpen={transferModal}
          title="Передати права кампанії?"
          message={selectedOwner
            ? `Новим власником стане ${selectedOwnerName}. Після підтвердження ви втратите роль власника.`
            : 'Підтвердити передачу прав кампанії?'}
          confirmText="Передати"
          onConfirm={handleTransferOwnership}
          onCancel={() => setTransferModal(false)}
        />
      )}

      <ConfirmModal {...leaveConfirmProps} />
    </DashboardCard>
  );
}

export default function CampaignSettingsWidget(props) {
  const { campaign } = props;

  if (!campaign) return null;

  return <CampaignSettingsWidgetContent key={campaign.id ?? 'new-campaign'} {...props} />;
}

CampaignSettingsWidget.propTypes = {
  campaign: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
};

CampaignSettingsWidgetContent.propTypes = {
  campaign: PropTypes.object,
  onSave: PropTypes.func,
  onTransferOwnership: PropTypes.func,
  onLeave: PropTypes.func,
  canTransferOwnership: PropTypes.bool,
  canManageShareLink: PropTypes.bool,
  currentShareLink: PropTypes.string,
  onRegenerateShareLink: PropTypes.func,
  onCopyShareLink: PropTypes.func,
  myRole: PropTypes.string,
  isLoading: PropTypes.bool,
  isRegeneratingShareLink: PropTypes.bool,
};
