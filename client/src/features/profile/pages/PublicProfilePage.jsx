import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import { CopyProfileLinkButton, BackButton } from '@/components/shared';
import { useProfileByUsername } from '@/features/profile/hooks/useProfileByUsername';
import ProfilePublicCard from '@/features/profile/components/ProfilePublicCard';
import { useBackDestination } from '@/hooks/useBackDestination';

/**
 * PublicProfilePage — сторінка /user/:username.
 *
 * BackButton автоматично визначає, звідки прийшов користувач
 * (сесія / кампанія / пошук / дашборд / зовнішнє посилання),
 * і показує відповідний підпис.
 */
export default function PublicProfilePage() {
  const { username } = useParams();
  const { label, fallbackTo } = useBackDestination();

  const { profile, isLoading, error } = useProfileByUsername(username);

  return (
    <div className="min-h-screen bg-brand-dark p-6">
      <div className="max-w-2xl mx-auto">
        <DashboardCard
          title={`Профіль гравця${profile?.username ? ` — @${profile.username}` : ''}`}
          actions={<BackButton variant="dark" label={label} fallbackTo={fallbackTo} />}
        >
          <ProfilePublicCard
            profile={profile}
            isLoading={isLoading}
            error={error}
            showStats
            showContactInfo
            shareButton={profile?.username ? <CopyProfileLinkButton username={profile.username} /> : null}
          />
        </DashboardCard>
      </div>
    </div>
  );
}
