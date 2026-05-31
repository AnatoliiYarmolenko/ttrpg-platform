import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import MenuButton from '@/components/ui/MenuButton';
import ProfileInfoWidget from './ProfileInfoWidget';
import ProfileEditForm from '@/features/profile/components/ProfileEditForm';
import AvatarUpload from '@/features/profile/components/AvatarUpload';
import PasswordChangeForm from '@/features/security/components/PasswordChangeForm';
import EmailChangeForm from '@/features/security/components/EmailChangeForm';
import DeleteAccountForm from '@/features/security/components/DeleteAccountForm';
import { PROFILE_SECTIONS } from './profileSections';
import { getTelegramLinkToken, unlinkTelegram, getMyProfile } from '@/features/profile/api/profileApi';
import { toast } from '@/stores/useToastStore';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmModal from '@/components/shared/ConfirmModal';

const MENU_ITEMS = [
  { id: PROFILE_SECTIONS.INFO, label: 'Інформація', description: 'Перегляд профілю' },
  { id: PROFILE_SECTIONS.EDIT, label: 'Змінити профіль', description: 'Редагувати дані' },
  { id: PROFILE_SECTIONS.SECURITY, label: 'Безпека', description: 'Пароль та доступ' },
  { id: PROFILE_SECTIONS.BALANCE, label: 'Поповнити баланс', description: 'Керування коштами' },
  { id: PROFILE_SECTIONS.INTEGRATIONS, label: 'Інтеграції', description: 'Telegram' },
];

export function ProfileMenuWidget({ currentSection, onSelectSection }) {
  return (
    <DashboardCard title="Меню профілю">
      <nav className="space-y-2">
        {MENU_ITEMS.map((item) => {
          const isActive = currentSection === item.id;
          return (
            <MenuButton
              key={item.id}
              label={item.label}
              description={item.description}
              isActive={isActive}
              onClick={() => onSelectSection(item.id)}
            />
          );
        })}
      </nav>
    </DashboardCard>
  );
}

ProfileMenuWidget.propTypes = {
  currentSection: PropTypes.string,
  onSelectSection: PropTypes.func.isRequired,
};

export function ProfileContentWidget({ currentSection, user, onProfileUpdate }) {
  const queryClient = useQueryClient();
  const [isLinkingTelegram, setIsLinkingTelegram] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const pollingIntervalRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleLinkTelegram = async () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    try {
      setIsLinkingTelegram(true);
      const res = await getTelegramLinkToken();
      if (res?.success && res.data?.token) {
        const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'myttrpg_dev_bot';
        window.open(`https://t.me/${botUsername}?start=${res.data.token}`, '_blank');
        let attempts = 0;
        pollingIntervalRef.current = setInterval(async () => {
          attempts++;
          try {
             const profileRes = await getMyProfile();
             if (profileRes?.profile?.telegramChatId) {
                onProfileUpdate({ 
                  ...user, 
                  telegramChatId: profileRes.profile.telegramChatId,
                  telegramLinkedAt: profileRes.profile.telegramLinkedAt
                });
                queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
                toast.success('Telegram успішно підключено!');
             }
          } catch (e) {
            console.error('Failed to refresh profile during Telegram link polling', e);
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          if (attempts >= 12 && pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }, 5000);
      }
    } catch {
      toast.error('Не вдалося згенерувати посилання');
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    try {
      setIsLinkingTelegram(true);
      await unlinkTelegram();
      toast.success('Telegram відв\'язано');
      onProfileUpdate({ ...user, telegramChatId: null, telegramLinkedAt: null });
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setShowUnlinkModal(false);
    } catch {
      toast.error('Не вдалося відв\'язати Telegram');
    } finally {
      setIsLinkingTelegram(false);
    }
  };

  switch (currentSection) {
    case PROFILE_SECTIONS.INFO:
      return <ProfileInfoWidget />;
    
    case PROFILE_SECTIONS.EDIT:
      return (
        <DashboardCard title="Редагування профілю">
          <div className="space-y-8">
            <section className="pb-6 border-b border-brand-light/30">
              <div className="mb-5">
                <h3 className="font-semibold text-brand-dark">Фото профілю</h3>
                <p className="text-xs text-brand-medium">Ваш аватар для інших гравців</p>
              </div>
              <AvatarUpload 
                currentAvatarUrl={user?.avatarUrl} 
                username={user?.displayName || user?.username}
                onUpdate={(updatedProfile) => {
                  if (onProfileUpdate && updatedProfile) {
                    onProfileUpdate(updatedProfile);
                  }
                }}
              />
            </section>
            
            <ProfileEditForm onSuccess={onProfileUpdate} />
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.SECURITY:
      return (
        <DashboardCard title="Безпека акаунту">
          <div className="space-y-8">
            <section>
              <div className="mb-5">
                <h3 className="font-semibold text-brand-dark">Зміна пароля</h3>
                <p className="text-xs text-brand-medium">Регулярно оновлюйте пароль для безпеки</p>
              </div>
              <PasswordChangeForm />
            </section>

            <section className="pt-6 border-t border-brand-light/30">
              <div className="mb-5">
                <h3 className="font-semibold text-brand-dark">Зміна email</h3>
                <p className="text-xs text-brand-medium">Змінити email для входу</p>
              </div>
              <EmailChangeForm currentEmail={user?.email} />
            </section>

            <section className="pt-6 border-t border-brand-light/30">
              <div className="mb-5">
                <h3 className="font-semibold text-red-600">Видалення акаунту</h3>
                <p className="text-xs text-red-400">Ця дія незворотна!</p>
              </div>
              <DeleteAccountForm />
            </section>
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.BALANCE:
      return (
        <DashboardCard title="Баланс та платежі">
          <div className="text-center py-12">
            <h3 className="text-xl font-bold text-brand-dark mb-2">Поповнення балансу</h3>
            <p className="text-brand-medium mb-6">
              Ця функція буде доступна найближчим часом
            </p>
            <div className="bg-brand-light/20 rounded-xl p-4 inline-block">
              <span className="text-brand-dark">Поточний баланс: </span>
              <span className="font-bold text-xl text-brand-dark">0 ₴</span>
            </div>
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.CHARACTERS:
      return (
        <DashboardCard title="Мої персонажі">
          <div className="text-center py-12">
            <h3 className="text-xl font-bold text-brand-dark mb-2">Персонажі</h3>
            <p className="text-brand-medium mb-6">
              Створюйте та керуйте своїми ігровими персонажами
            </p>
            <Button
              variant="secondary"
              fullWidth={false}
              className="px-6 py-3 rounded-xl font-bold"
            >
              + Створити персонажа
            </Button>
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.INTEGRATIONS:
      return (
        <DashboardCard title="Інтеграції">
          <div className="space-y-4">
            <p className="text-brand-medium mb-6">
              Підключіть свої акаунти для зручності
            </p>
            

            <div className="flex items-center justify-between p-4 border-2 border-brand-light/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-bold text-brand-dark">Telegram</div>
                  <div className="text-xs text-brand-medium">
                    {user?.telegramChatId ? 'Підключено' : 'Не підключено'}
                  </div>
                </div>
              </div>
              {user?.telegramChatId ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    fullWidth={false}
                    onClick={() => {
                      const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'myttrpg_dev_bot';
                      window.open(`https://t.me/${botUsername}`, '_blank');
                    }}
                  >
                    Відкрити бота
                  </Button>
                  <Button
                    variant="danger"
                    fullWidth={false}
                    onClick={() => setShowUnlinkModal(true)}
                    isLoading={isLinkingTelegram}
                  >
                    Відв'язати
                  </Button>
                </div>
              ) : (
                <Button
                  variant="primary"
                  fullWidth={false}
                  onClick={handleLinkTelegram}
                  isLoading={isLinkingTelegram}
                >
                  Підключити
                </Button>
              )}
            </div>
            
            <ConfirmModal
              isOpen={showUnlinkModal}
              title="Відв'язати Telegram?"
              message="Ви впевнені, що хочете відв'язати ваш акаунт Telegram? Ви більше не отримуватимете сповіщення."
              confirmText="Відв'язати"
              cancelText="Скасувати"
              variant="danger"
              isLoading={isLinkingTelegram}
              onConfirm={handleUnlinkTelegram}
              onCancel={() => setShowUnlinkModal(false)}
            />
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.STATS:
      return (
        <DashboardCard title="Статистика та досягнення">
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-brand-light/10 rounded-xl">
                <div className="text-3xl font-bold text-brand-dark">0</div>
                <div className="text-sm text-brand-medium">Сесій зіграно</div>
              </div>
              <div className="text-center p-4 bg-brand-light/10 rounded-xl">
                <div className="text-3xl font-bold text-brand-dark">0</div>
                <div className="text-sm text-brand-medium">Годин гри</div>
              </div>
              <div className="text-center p-4 bg-brand-light/10 rounded-xl">
                <div className="text-3xl font-bold text-brand-dark">0</div>
                <div className="text-sm text-brand-medium">Кампаній</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-bold text-brand-dark mb-3">Досягнення</h4>
              <div className="text-center py-8 text-brand-medium border-2 border-dashed border-brand-light/30 rounded-xl">
                Ваші досягнення з'являться тут після першої гри
              </div>
            </div>
          </div>
        </DashboardCard>
      );
    
    default:
      return <ProfileInfoWidget />;
  }
}

ProfileContentWidget.propTypes = {
  currentSection: PropTypes.string,
  user: PropTypes.object,
  onProfileUpdate: PropTypes.func,
};

export default function ProfilePageWidget({ user, onProfileUpdate }) {
  const [currentSection, setCurrentSection] = useState(PROFILE_SECTIONS.INFO);

  return {
    left: <ProfileContentWidget 
            currentSection={currentSection} 
            user={user} 
            onProfileUpdate={onProfileUpdate} 
          />,
    right: <ProfileMenuWidget 
             currentSection={currentSection} 
             onSelectSection={setCurrentSection}
             user={user}
           />,
  };
}
