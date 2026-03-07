import React, { useState } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import FormField from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ConfirmModal } from '@/components/shared';
import { GAME_SYSTEMS } from '@/constants/gameSystems';

/**
 * CampaignSettingsWidget — лівий віджет в табі "Налаштування" (тільки Власник).
 *
 * Дозволяє редагувати:
 * - Назву, опис
 * - Систему гри
 * - Видимість (PUBLIC, PRIVATE, LINK_ONLY)
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
  const [transferModal, setTransferModal] = useState(false);
  const [selectedNewOwnerId, setSelectedNewOwnerId] = useState('');

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

  const handleTransferOwnership = async () => {
    if (!canTransferOwnership || !selectedNewOwnerId) return;

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
            >
              <option value="PUBLIC">🌍 Публічна</option>
              <option value="PRIVATE">🔒 Приватна</option>
              <option value="LINK_ONLY">🔗 За посиланням</option>
            </select>
          </FormField>
        </div>

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
        >
          Зберегти зміни
        </Button>

        {/* Секція небезпечних дій (тільки для Owner) */}
        {(canDelete || canTransferOwnership) && (
          <div className="border-t border-red-200 pt-4 mt-2">
            <h4 className="text-sm font-bold text-red-600 mb-3">Небезпечна зона</h4>

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
                      disabled={!selectedNewOwnerId || isLoading}
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
