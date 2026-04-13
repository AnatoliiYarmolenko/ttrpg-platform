import React from 'react';
import { UserAvatar } from '@/components/shared';
import Timer from '@/components/ui/icons/Timer';
import Dice20 from '@/components/ui/icons/Dice20';
import { formatTimeZoneLabel } from '@/utils/timeZone';

/**
 * ProfilePublicCard вЂ” презентаційний компонент публічного профілю гравця.
 *
 * Не містить логіки завантаження вЂ” очікує готові дані ззовні.
 * Обгортку (DashboardCard, сторінковий лейаут) визначає батьківський компонент.
 *
 * @param {Object}  props
 * @param {import('../profileModel').ProfileShape|null} props.profile
 * @param {boolean} props.isLoading
 * @param {string|null} props.error
 * @param {boolean} [props.showStats=true]       вЂ” бейджі «сесій / годин»
 * @param {boolean} [props.showContactInfo=true] вЂ” timezone, мова, місто
 * @param {React.ReactNode} [props.shareButton]  вЂ” кнопка «поділитися» (CopyProfileLinkButton або null)
 */
export default function ProfilePublicCard({
  profile,
  isLoading,
  error,
  showStats = true,
  showContactInfo = true,
  shareButton = null,
}) {
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 py-8">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-brand-light/20 rounded-full" />
        </div>
        <div className="h-6 bg-brand-light/20 rounded w-1/2 mx-auto" />
        <div className="h-4 bg-brand-light/20 rounded w-2/3 mx-auto" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-brand-medium">
        <p className="text-lg">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.displayName || profile.username || 'Невідомий';
  const hasContactInfo =
    showContactInfo && (profile.timezone || profile.language || profile.city || profile.preferredSystem);

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      <UserAvatar src={profile.avatarUrl} name={displayName} size="lg" />

      <div className="text-center">
        <h2 className="text-2xl font-bold text-brand-dark">{displayName}</h2>
        {profile.username && (
          <p className="text-brand-medium">@{profile.username}</p>
        )}
        {shareButton && (
          <div className="mt-3 flex justify-center">
            {shareButton}
          </div>
        )}
      </div>

      {showStats && (
        <div className="flex gap-3 text-sm flex-wrap justify-center">
          <div className="bg-brand-light/20 px-3 py-1 rounded-full text-brand-dark flex items-center gap-1.5">
            <Dice20 className="w-4 h-4" />
            {profile.stats?.sessionsPlayed || 0} сесій
          </div>
          <div className="bg-brand-light/20 px-3 py-1 rounded-full text-brand-dark flex items-center gap-1.5">
            <Timer className="w-4 h-4" />
            {profile.stats?.hoursPlayed || 0} годин
          </div>
        </div>
      )}

      {profile.bio && (
        <div className="w-full border-t border-brand-light/20 pt-4">
          <h4 className="text-sm font-bold text-brand-dark mb-2">Про гравця</h4>
          <p className="text-sm text-brand-medium whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}

      {hasContactInfo && (
        <div className="w-full border-t border-brand-light/20 pt-4 space-y-2">
          {profile.timezone && (
            <div className="flex items-center gap-2 text-sm text-brand-medium">
              <span>Часовий пояс: {formatTimeZoneLabel(profile.timezone)}</span>
            </div>
          )}
          {profile.language && (
            <div className="flex items-center gap-2 text-sm text-brand-medium">
              <span>Мова: {profile.language}</span>
            </div>
          )}
          {profile.city && (
            <div className="flex items-center gap-2 text-sm text-brand-medium">
              <span>{profile.city}</span>
            </div>
          )}
          {profile.preferredSystem && (
            <div className="flex items-center gap-2 text-sm text-brand-medium">
              <Dice20 className="w-4 h-4" />
              <span>{profile.preferredSystem}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
