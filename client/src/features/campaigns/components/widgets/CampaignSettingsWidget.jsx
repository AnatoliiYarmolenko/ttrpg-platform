import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ConfirmModal, StatusBadge } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';

const normalizeVisibility = (value) => (value === 'PRIVATE' ? 'LINK_ONLY' : value);

function buildFormData(campaign) {
  return {
    title: campaign?.title || '',
    description: campaign?.description || '',
    system: campaign?.system || '',
    visibility: normalizeVisibility(campaign?.visibility || 'PUBLIC'),
  };
}

function CampaignSettingsWidgetContent({
  campaign,
  onSave,
  onTransferOwnership,
  canTransferOwnership = false,
  isLoading = false,
}) {
  const [formData, setFormData] = useState(() => buildFormData(campaign));
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');

  const isCampaignFinished = campaign?.status === 'FINISHED';
  const controlsDisabled = isLoading || isCampaignFinished;

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

    const data = {};
    if (formData.title.trim()) data.title = formData.title.trim();
    if (formData.description.trim()) data.description = formData.description.trim();
    data.system = formData.system || null;
    data.visibility = normalizeVisibility(formData.visibility);

    const result = await onSave?.(data);
    if (result?.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
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

  const inputClasses =
    'w-full p-3 border-2 border-brand-light/50 rounded-xl focus:border-brand-dark text-brand-dark bg-white transition-colors';

  return (
    <DashboardCard title="Налаштування кампанії">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

        <div className="grid grid-cols-2 gap-3">
          <FormField id="system" label="Ігрова система">
            <select
              id="system"
              name="system"
              value={formData.system}
              onChange={handleChange}
              className={inputClasses}
              disabled={controlsDisabled}
            >
              <option value="">Не вказано</option>
              {GAME_SYSTEMS.map((system) => (
                <option key={system.value} value={system.value}>
                  {system.icon} {system.label}
                </option>
              ))}
            </select>
          </FormField>

          <FormField id="visibility" label="Видимість">
            <select
              id="visibility"
              name="visibility"
              value={formData.visibility}
              onChange={handleChange}
              className={inputClasses}
              disabled={controlsDisabled}
            >
              <option value="PUBLIC">За заявкою</option>
              <option value="LINK_ONLY">За посиланням</option>
            </select>
          </FormField>
        </div>

        <div className="p-4 bg-brand-light/10 rounded-xl border border-brand-light/30 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-brand-dark">Статус кампанії</span>
            <span className="text-xs text-brand-medium">
              Після завершення кампанії створення сесій, вступ та редагування будуть недоступні.
            </span>
          </div>
          <StatusBadge status={campaign.status || 'ACTIVE'} />
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

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          loadingText="Збереження..."
          disabled={controlsDisabled}
          fullWidth={true}
        >
          Зберегти зміни
        </Button>

        {canTransferOwnership && (
          <div className="border-t border-red-200 pt-4 mt-2">
            <h4 className="text-sm font-bold text-red-600 mb-3">Небезпечна зона</h4>

            {!isCampaignFinished && (
              <div className="mb-5 p-3 border-2 border-amber-200 rounded-xl bg-amber-50/70">
                <p className="text-xs text-amber-800 mb-3">
                  Після завершення кампанії не можна буде додавати нові сесії, приєднуватися до них або змінювати налаштування.
                </p>
                <Button
                  variant="danger"
                  disabled={isLoading}
                  onClick={() => setFinishModal(true)}
                  fullWidth={true}
                >
                  Завершити кампанію
                </Button>
              </div>
            )}

            <div className="mb-5 p-3 border-2 border-brand-light/30 rounded-xl bg-brand-light/5">
              <p className="text-xs text-brand-medium mb-3">
                Передача прав власності змінить власника кампанії. Ви станете майстром цієї кампанії.
              </p>

              {eligibleNewOwners.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <select
                    value={selectedNewOwnerId}
                    onChange={(event) => setSelectedNewOwnerId(event.target.value)}
                    className={inputClasses}
                    disabled={isCampaignFinished}
                  >
                    <option value="">Оберіть нового власника</option>
                    {eligibleNewOwners.map((member) => {
                      const displayName = member.user?.displayName || member.user?.username || `User #${member.userId}`;
                      return (
                        <option key={member.id} value={member.userId}>
                          {displayName}
                        </option>
                      );
                    })}
                  </select>

                  <Button
                    variant="outline"
                    disabled={!selectedNewOwnerId || isLoading || isCampaignFinished}
                    onClick={() => setTransferModal(true)}
                    fullWidth={true}
                  >
                    Передати права кампанії
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-brand-medium">Немає доступних учасників для передачі прав.</p>
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
    </DashboardCard>
  );
}

export default function CampaignSettingsWidget(props) {
  const { campaign } = props;

  if (!campaign) return null;

  return <CampaignSettingsWidgetContent key={campaign.id ?? 'new-campaign'} {...props} />;
}
