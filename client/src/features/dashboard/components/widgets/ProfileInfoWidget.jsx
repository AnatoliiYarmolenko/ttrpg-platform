import React, { useState, useEffect } from 'react';
import DashboardCard from '@/components/ui/DashboardCard';
import { ViewProfileButton } from '@/components/shared';
import { useProfileByUsernameQuery } from '@/features/profile/hooks/useProfileQueries';
import ProfilePublicCard from '@/features/profile/components/ProfilePublicCard';
import useAuthStore from '@/stores/useAuthStore';

/**
 * ProfileInfoWidget — «Перегляд профілю» у власному кабінеті.
 *
 * Відповідає виключно за логіку отримання даних:
 *   - mode='me'       → бере профіль з authStore (без фетчу)
 *   - mode='username' → завантажує публічний профіль за username
 *
 * Рендер повністю делегується ProfilePublicCard, щоб власник
 * бачив свій профіль так само, як його бачать інші.
 *
 * @param {'me'|'username'} mode
 * @param {string}  [username]
 * @param {Object}  [profile]   — зовнішній профіль (пропускає фетч)
 * @param {string}  [title]
 */
export default function ProfileInfoWidget({
  mode = 'me',
  username,
  profile: profileProp = null,
  title = 'Інформація про гравця',
}) {
  const authUser = useAuthStore((state) => state.user);
  
  const shouldFetch = mode === 'username' && !profileProp && !!username;
  const {
    data: fetchedProfile,
    isLoading: isFetching,
    error: fetchError,
    isRefetching
  } = useProfileByUsernameQuery(shouldFetch ? username : null);

  let profile = profileProp;
  if (!profile) {
    if (mode === 'me') {
      profile = authUser;
    } else {
      profile = fetchedProfile;
    }
  }

  const isLoading = shouldFetch && isFetching;
  const isRefreshing = shouldFetch && isRefetching;
  const error = shouldFetch && fetchError
    ? (fetchError.response?.status === 404 ? 'Користувача не знайдено' : 'Не вдалося завантажити профіль')
    : (!profileProp && mode === 'username' && !username ? 'Не вказано username' : null);

  return (
    <DashboardCard title={title}>
      {isRefreshing && (
        <div className="mb-3 text-xs text-[#4D774E]">Оновлюємо профіль...</div>
      )}
      <ProfilePublicCard
        profile={profile}
        isLoading={isLoading && !profile}
        error={error}
        showStats
        showContactInfo
        shareButton={
          profile?.username
            ? <ViewProfileButton username={profile.username} />
            : null
        }
      />
    </DashboardCard>
  );
}