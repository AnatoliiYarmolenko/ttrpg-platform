import React from "react";
import DashboardCard from "@/components/ui/DashboardCard";
import { ViewProfileButton } from "@/components/shared";
import { useProfileByUsernameQuery } from "@/features/profile/hooks/useProfileQueries";
import ProfilePublicCard from "@/features/profile/components/ProfilePublicCard";
import useAuthStore from "@/stores/useAuthStore";

function resolveWidgetProfile({ mode, profileProp, authUser, fetchedProfile }) {
  if (profileProp) {
    return profileProp;
  }

  return mode === "me" ? authUser : fetchedProfile;
}

function resolveWidgetError({ shouldFetch, fetchError, profileProp, mode, username }) {
  if (shouldFetch && fetchError) {
    return fetchError.response?.status === 404
      ? 'Користувача не знайдено'
      : 'Не вдалося завантажити профіль';
  }

  if (!profileProp && mode === 'username' && !username) {
    return 'Не вказано username';
  }

  return null;
}

export default function ProfileInfoWidget({
  mode = 'me',
  username,
  profile: profileProp = null,
  title = 'Інформація про гравця',
}) {
  const authUser = useAuthStore((state) => state.user);

  const shouldFetch = mode === "username" && !profileProp && Boolean(username);
  const {
    data: fetchedProfile,
    isLoading: isFetching,
    error: fetchError,
    isRefetching,
  } = useProfileByUsernameQuery(shouldFetch ? username : null);

  const profile = resolveWidgetProfile({
    mode,
    profileProp,
    authUser,
    fetchedProfile,
  });
  const isLoading = shouldFetch && isFetching;
  const isRefreshing = shouldFetch && isRefetching;
  const error = resolveWidgetError({
    shouldFetch,
    fetchError,
    profileProp,
    mode,
    username,
  });

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
        shareButton={profile?.username ? <ViewProfileButton username={profile.username} /> : null}
      />
    </DashboardCard>
  );
}
