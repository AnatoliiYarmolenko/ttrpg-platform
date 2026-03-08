import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ConfirmModal, StatusBadge } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';

/**
 * CampaignSettingsWidget — лівий віджет в табі "Налаштування" (тільки Власник).
 *
 * Дозволяє редагувати:
 * - Назву, опис
 * - Систему гри
 * - Видимість (PUBLIC, PRIVATE, LINK_ONLY)
 * - Завершити кампанію (без можливості повернути в ACTIVE)
 * - Видалити кампанію (Owner only)
 *
 * @param {Object} campaign — поточна кампанія
 * @param {Function} onSave — колбек збереження (campaignData)
 * @param {Function} onDelete — колбек видалення кампанії
 * @param {boolean} canDelete — чи може юзер видаляти кампанію (тільки Owner)
 * @param {boolean} canTransferOwnership — чи може юзер передати права (тільки Owner)
 * @param {boolean} isLoading
 */
export default function CampaignSettingsWidget({
  campaign,
  onSave,
  onDelete,
  onTransferOwnership,
  canDelete = false,
  canTransferOwnership = false,
  isLoading = false,
}) {
  const buildFormData = (c) => ({
    title: c?.title || '',
    description: c?.description || '',
    system: c?.system || '',
    visibility: c?.visibility || 'PUBLIC',
  });

  const [formData, setFormData] = useState(() => buildFormData(campaign));
  const [formCampaignId, setFormCampaignId] = useState(campaign?.id ?? null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');
  const isCampaignFinished = campaign?.status === 'FINISHED';
  const controlsDisabled = isLoading || isCampaignFinished;

  // Скидати форму при зміні кампанії (обчислення під час рендеру, без effect)
  if (campaign?.id !== formCampaignId) {
    setFormCampaignId(campaign?.id ?? null);
    setFormData(buildFormData(campaign));
    setSelectedNewOwnerId('');
  }

  const eligibleNewOwners = (campaign?.members || [])
    .filter((member) => member.userId !== campaign.ownerId)
    .filter((member, index, array) => array.findIndex((m) => m.userId === member.userId) === index);

  const selectedOwner = eligibleNewOwners.find(
    (member) => String(member.userId) === String(selectedNewOwnerId)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSaveSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isCampaignFinished) {
      return;
    }

    const data = {};
    if (formData.title.trim()) data.title = formData.title.trim();
    if (formData.description.trim()) data.description = formData.description.trim();
    data.system = formData.system || null;
    data.visibility = formData.visibility;

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

  const handleFinishCampaign = async () => {
    setFinishModal(false);

    if (isCampaignFinished) {
      return;
    }

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

  if (!campaign) return null;

  const inputClasses =
    'w-full p-3 border-2 border-[#9DC88D]/50 rounded-xl focus:border-[#164A41] outline-none text-[#164A41] bg-white transition-colors';

  return (
    <DashboardCard title="Налаштування кампанії">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Назва */}
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

        {/* Опис */}
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

        {/* Система та Видимість */}
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
              {GAME_SYSTEMS.map((sys) => (
                <option key={sys.value} value={sys.value}>
                  {sys.icon} {sys.label}
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
              {formData.visibility === 'PRIVATE' && (
                <option value="PRIVATE">🔒 Приватна (legacy)</option>
              )}
              <option value="PUBLIC">📝 За заявкою</option>
              <option value="LINK_ONLY">🔗 За посиланням</option>
            </select>
          </FormField>
        </div>

        <div className="p-4 bg-[#9DC88D]/10 rounded-xl border border-[#9DC88D]/30 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-[#164A41]">Статус кампанії</span>
            <span className="text-xs text-[#4D774E]">
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

        {/* Успішне збереження */}
        {saveSuccess && (
          <div className="text-sm text-green-600 p-3 bg-green-50 rounded-lg">
            Зміни збережено!
          </div>
        )}

        {/* Кнопка збереження */}
        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          loadingText="Збереження..."
          disabled={controlsDisabled}
        >
          Зберегти зміни
        </Button>

        {/* Секція небезпечних дій (тільки для Owner) */}
        {(canDelete || canTransferOwnership) && (
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
                >
                  Завершити кампанію
                </Button>
              </div>
            )}

            {canTransferOwnership && (
              <div className="mb-5 p-3 border-2 border-[#9DC88D]/30 rounded-xl bg-[#9DC88D]/5">
                <p className="text-xs text-[#4D774E] mb-3">
                  Передача прав власності змінить Власника кампанії. Ви станете Майстром цієї кампанії.
                </p>

                {eligibleNewOwners.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <select
                      value={selectedNewOwnerId}
                      onChange={(event) => setSelectedNewOwnerId(event.target.value)}
                      className={inputClasses}
                      disabled={isCampaignFinished}
                    >
                      <option value="">Оберіть нового Власника</option>
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
                    >
                      Передати права кампанії
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-[#4D774E]">Немає доступних учасників для передачі прав.</p>
                )}
              </div>
            )}

            {canDelete && (
              <>
                <p className="text-xs text-red-500 mb-3">
                  Видалення кампанії призведе до втрати всіх сесій та даних. Цю дію неможливо відмінити.
                </p>
                <Button
                  variant="danger"
                  onClick={() => setDeleteModal(true)}
                >
                  Видалити кампанію
                </Button>
              </>
            )}
          </div>
        )}
      </form>

      {/* Модалка підтвердження видалення */}
      {canDelete && (
        <ConfirmModal
          isOpen={deleteModal}
          title="Видалити кампанію?"
          message={`Ви впевнені, що хочете видалити кампанію "${campaign.title}"? Всі сесії кампанії також будуть видалені. Цю дію неможливо відмінити.`}
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={finishModal}
        title="Завершити кампанію?"
        message="Після підтвердження кампанія стане завершеною. Додавання сесій, вступ і зміна налаштувань будуть заблоковані. Цю дію не можна скасувати."
        variant="danger"
        onConfirm={handleFinishCampaign}
        onCancel={() => setFinishModal(false)}
      />

      {canTransferOwnership && (
        <ConfirmModal
          isOpen={transferModal}
          title="Передати права кампанії?"
          message={selectedOwner
            ? `Новим власником стане ${selectedOwner.user?.displayName || selectedOwner.user?.username || `User #${selectedOwner.userId}`}. Після підтвердження ви втратите роль Власника.`
            : 'Підтвердити передачу прав кампанії?'}
          onConfirm={handleTransferOwnership}
          onCancel={() => setTransferModal(false)}
        />
      )}
    </DashboardCard>
  );
}
