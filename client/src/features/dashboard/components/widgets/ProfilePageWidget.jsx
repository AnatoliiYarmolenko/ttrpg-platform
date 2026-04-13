import React, { useState } from 'react';
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

// Конфігурація меню
const MENU_ITEMS = [
  { id: PROFILE_SECTIONS.INFO, label: 'Інформація', description: 'Перегляд профілю' },
  { id: PROFILE_SECTIONS.EDIT, label: 'Змінити профіль', description: 'Редагувати дані' },
  { id: PROFILE_SECTIONS.SECURITY, label: 'Безпека', description: 'Пароль та доступ' },
  { id: PROFILE_SECTIONS.BALANCE, label: 'Поповнити баланс', description: 'Керування коштами' },
  { id: PROFILE_SECTIONS.CHARACTERS, label: 'Персонажі', description: 'Ваші герої' },
  { id: PROFILE_SECTIONS.INTEGRATIONS, label: 'Інтеграції', description: 'Discord, Telegram' },
  { id: PROFILE_SECTIONS.STATS, label: 'Статистика', description: 'Досягнення та історія' },
];

/**
 * Меню профілю (права панель)
 */
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

/**
 * Контент профілю (ліва панель) — змінюється залежно від вибраної секції
 */
export function ProfileContentWidget({ currentSection, user, onProfileUpdate }) {
  // Рендеримо контент залежно від вибраної секції
  switch (currentSection) {
    case PROFILE_SECTIONS.INFO:
      return <ProfileInfoWidget />;
    
    case PROFILE_SECTIONS.EDIT:
      return (
        <DashboardCard title="Редагування профілю">
          <div className="space-y-8">
            {/* ===== Секція: Фото профілю ===== */}
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
            
            {/* Форма редагування (профіль + налаштування) */}
            <ProfileEditForm onSuccess={onProfileUpdate} />
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.SECURITY:
      return (
        <DashboardCard title="Безпека акаунту">
          <div className="space-y-8">
            {/* ===== Секція: Зміна пароля ===== */}
            <section>
              <div className="mb-5">
                <h3 className="font-semibold text-brand-dark">Зміна пароля</h3>
                <p className="text-xs text-brand-medium">Регулярно оновлюйте пароль для безпеки</p>
              </div>
              <PasswordChangeForm />
            </section>

            {/* ===== Секція: Зміна email ===== */}
            <section className="pt-6 border-t border-brand-light/30">
              <div className="mb-5">
                <h3 className="font-semibold text-brand-dark">Зміна email</h3>
                <p className="text-xs text-brand-medium">Змінити email для входу</p>
              </div>
              <EmailChangeForm currentEmail={user?.email} />
            </section>

            {/* ===== Секція: Видалення акаунту ===== */}
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
            
            {/* Discord */}
            <div className="flex items-center justify-between p-4 border-2 border-brand-light/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-bold text-brand-dark">Discord</div>
                  <div className="text-xs text-brand-medium">Не підключено</div>
                </div>
              </div>
              <Button
                variant="light"
                fullWidth={false}
                className="px-4 py-2 bg-indigo-500 text-white hover:bg-indigo-600 hover:text-white rounded-lg font-medium shadow-none hover:shadow-none"
              >
                Підключити
              </Button>
            </div>
            
            {/* Telegram */}
            <div className="flex items-center justify-between p-4 border-2 border-brand-light/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div>
                  <div className="font-bold text-brand-dark">Telegram</div>
                  <div className="text-xs text-brand-medium">Не підключено</div>
                </div>
              </div>
              <Button
                variant="light"
                fullWidth={false}
                className="px-4 py-2 bg-sky-500 text-white hover:bg-sky-600 hover:text-white rounded-lg font-medium shadow-none hover:shadow-none"
              >
                Підключити
              </Button>
            </div>
          </div>
        </DashboardCard>
      );
    
    case PROFILE_SECTIONS.STATS:
      return (
        <DashboardCard title="Статистика та досягнення">
          <div className="space-y-6">
            {/* Загальна статистика */}
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
            
            {/* Досягнення */}
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

/**
 * Головний компонент сторінки профілю
 * Керує станом вибраної секції
 */
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
