import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import { EmptyState, DateTimeDisplay, SessionTimeBadge } from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Dice20 from '@/components/ui/icons/Dice20';

const UI_LOCALE = 'uk-UA';

/**
 * Знаходить найрелевантнішу сесію для відображення:
 * 1. Перша ACTIVE сесія (якщо є)
 * 2. Найближча майбутня PLANNED сесія (дата >= зараз)
 * 3. Остання PLANNED сесія (якщо всі в минулому — крайній випадок)
 */
function findNextRelevantSession(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  const active = sessions.find((s) => s.status === 'ACTIVE');
  if (active) return active;

  const now = Date.now();
  const planned = sessions
    .filter((s) => s.status === 'PLANNED')
    .map((s) => ({ ...s, _time: new Date(s.date).getTime() }))
    .sort((a, b) => a._time - b._time);

  if (planned.length === 0) return null;

  const upcoming = planned.find((s) => s._time >= now);
  return upcoming ?? planned.at(-1);
}



const CAMPAIGN_SESSION_VISIBILITY_LABELS = {
  PRIVATE: 'Звичайна сесія',
  PUBLIC: 'Гостьова сесія',
};

const resolveOrganizerName = ({ session, campaignOwner, campaignMembers }) => {
  const fromSession = session?.organizerName || session?.owner?.displayName || session?.owner?.username;
  if (fromSession) return fromSession;

  const ownerId = Number(session?.ownerId);
  if (Number.isFinite(ownerId) && ownerId > 0) {
    const member = Array.isArray(campaignMembers)
      ? campaignMembers.find((item) => Number(item?.userId) === ownerId)
      : null;

    const memberName = member?.user?.displayName || member?.user?.username;
    if (memberName) return memberName;

    const campaignOwnerId = Number(campaignOwner?.id);
    if (campaignOwnerId === ownerId) {
      const campaignOwnerName = campaignOwner?.displayName || campaignOwner?.username;
      if (campaignOwnerName) return campaignOwnerName;
    }

    return `User #${ownerId}`;
  }

  return 'Не вказаний';
};

/**
 * CampaignNextSessionWidget — ліва панель таба "Сесії".
 * Відображає найближчу (ACTIVE або найближча PLANNED) сесію кампанії.
 */
export default function CampaignNextSessionWidget({
  sessions = [],
  campaignOwner = null,
  campaignMembers = [],
}) {
  const navigate = useNavigate();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setNowMs(Date.now());
    }, 30 * 1000);
    return () => globalThis.clearInterval(intervalId);
  }, []);

  const session = useMemo(() => findNextRelevantSession(sessions), [sessions]);



if (!session) {
    return (
      <DashboardCard title="Наступна сесія">
        {/* Додано обгортку h-full для заповнення висоти та flex для центрування */}
        <div className="flex items-center justify-center w-full h-full min-h-[300px]">
          <EmptyState
            icon={<Dice20 className="w-14 h-14" />}
            title="Немає запланованих сесій"
          />
        </div>
      </DashboardCard>
    );
  }
  
  const participantCount =
    session?.participants?.length ??
    session?._count?.participants ??
    session?.participantsSummaryCount ??
    0;

  const playersCapacity = Number(session?.maxPlayers);
  const hasPlayersCapacity = Number.isFinite(playersCapacity) && playersCapacity > 0;
  
  const availabilityLabel = CAMPAIGN_SESSION_VISIBILITY_LABELS[session?.visibility]
    || CAMPAIGN_SESSION_VISIBILITY_LABELS.PRIVATE;

  const systemName = session.system || 'Не вказана';
  const organizerName = resolveOrganizerName({ session, campaignOwner, campaignMembers });

  return (
    <DashboardCard title="Наступна сесія">
      <div className="flex flex-col gap-4 h-full">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-2">
            <h3 className="text-xl font-bold text-brand-dark leading-tight truncate flex-1 min-w-0">
              {session.title}
            </h3>
          <SessionTimeBadge session={session} nowMs={nowMs} />
          </div>

        {/* Деталі */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 p-4 bg-brand-light/10 rounded-xl">
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Data className="w-4 h-4 shrink-0" />
            <DateTimeDisplay value={session.date} format="long" fallback="Дата не вказана" />
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Система:</span>
            <span>{systemName}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Timer className="w-4 h-4 shrink-0" />
            <time>{session.date ? new Date(session.date).toLocaleTimeString(UI_LOCALE, { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Доступність:</span>
            <span>{availabilityLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <GroupPeople className="w-4 h-4 shrink-0" />
            <span>
              {hasPlayersCapacity ? `${participantCount} / ${playersCapacity} гравців` : `${participantCount} гравців`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Організатор:</span>
            <span>{organizerName}</span>
          </div>
        </div>

        {/* Опис */}
        <div className="border-t border-brand-light/20 pt-3">
          <h4 className="text-sm font-bold text-brand-dark mb-3">Опис</h4>
          <p className="text-sm text-brand-medium whitespace-pre-wrap leading-relaxed">
            {session.description?.trim() || 'Опис відсутній'}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-auto pt-2">
          <Button
            onClick={() => navigate(`/session/${session.id}`)}
            fullWidth={true}
            className="w-full min-h-[43px]"
          >
            Перейти до сесії
          </Button>
        </div>
      </div>
    </DashboardCard>
  );
}
