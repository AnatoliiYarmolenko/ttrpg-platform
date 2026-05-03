import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import { EmptyState, DateTimeDisplay, SessionTimeBadge, StatusBadge } from '@/components/shared';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Dice20 from '@/components/ui/icons/Dice20';
import { VisibilityBadge } from '@/components/shared';

const UI_LOCALE = 'uk-UA';

/**
 * Допуск для PLANNED сесій — відповідає серверному `plannedToleranceMinutes`.
 * Сесія не вважається "минулою", якщо запізнення менше 2 хвилин.
 */
const PLANNED_TOLERANCE_MS = 2 * 60 * 1000;

/**
 * Знаходить найрелевантнішу сесію для відображення:
 * 1. Перша ACTIVE сесія (якщо є)
 * 2. Найближча майбутня PLANNED сесія (з допуском 2 хв на запізнення старту)
 * 3. null — якщо жодна актуальна сесія не знайдена
 *
 * На відміну від попередньої реалізації, НЕ повертає минулі PLANNED сесії —
 * щоб уникнути показу "наступної сесії", яка вже не відбудеться.
 */
function findNextRelevantSession(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  const active = sessions.find((s) => s.status === 'ACTIVE');
  if (active) return active;

  const now = Date.now();
  const upcoming = sessions
    .filter((s) => s.status === 'PLANNED')
    .map((s) => ({ ...s, _time: new Date(s.date).getTime() }))
    .filter((s) => s._time >= now - PLANNED_TOLERANCE_MS)
    .sort((a, b) => a._time - b._time);

  return upcoming[0] ?? null;
}



/**
 * CampaignNextSessionWidget — ліва панель таба "Сесії".
 * Відображає найближчу (ACTIVE або найближча PLANNED) сесію кампанії.
 */
export default function CampaignNextSessionWidget({
  sessions = [],
  campaignTitle = '',
  campaignNavigationTarget = null,
  campaignShareToken = null,
}) {
  const navigate = useNavigate();

  const session = useMemo(() => findNextRelevantSession(sessions), [sessions]);

  if (!session) {
    return (
      <DashboardCard title="Наступна сесія">
        <div className="flex items-center justify-center w-full h-full min-h-[300px]">
          <EmptyState
            icon={<Dice20 className="w-14 h-14" />}
            title="Немає запланованих сесій"
          />
        </div>
      </DashboardCard>
    );
  }

  const participantCount = Number.isFinite(Number(session?.participantsSummaryCount))
    ? Number(session.participantsSummaryCount)
    : (
      session?._count?.participants ??
      session?.participants?.length ??
      0
    );

  const playersCapacity = Number(session?.maxPlayers);
  const hasPlayersCapacity = Number.isFinite(playersCapacity) && playersCapacity > 0;


  const systemName = session.system || 'Не вказана';
  const organizerName = session.organizerName || 'Не вказаний';
  const sessionTarget = campaignShareToken
    ? `/session/${session.id}?campaignShareToken=${encodeURIComponent(campaignShareToken)}`
    : `/session/${session.id}`;
  const shouldRenderCampaignLink = Boolean(campaignTitle && campaignNavigationTarget);

  return (
    <DashboardCard title="Наступна сесія">
      <div className="flex flex-col gap-4 h-full">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xl font-bold text-brand-dark leading-tight truncate flex-1 min-w-0">
            {session.title}
          </h3>
          {['FINISHED', 'CANCELED'].includes(session.status)
            ? <StatusBadge status={session.status} />
            : <SessionTimeBadge session={session} />}
        </div>

        {campaignTitle && (
          <div className="text-brand-medium text-sm leading-tight truncate">
            <span className="font-medium">Кампанія:</span>{' '}
            {shouldRenderCampaignLink ? (
              <Link to={campaignNavigationTarget} className="underline hover:no-underline">
                {campaignTitle}
              </Link>
            ) : (
              campaignTitle
            )}
          </div>
        )}

        {/* Деталі */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 p-4 bg-brand-light/10 rounded-xl">
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Data className="w-4 h-4 shrink-0" />
            <DateTimeDisplay value={session.startAt} format="long" fallback="Дата не вказана" />
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Система:</span>
            <span>{systemName}</span>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <Timer className="w-4 h-4 shrink-0" />
            <time>{session.startAt ? new Date(session.startAt).toLocaleTimeString(UI_LOCALE, { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
          </div>

          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Доступність:</span>
            <VisibilityBadge visibility={session?.visibility} entityType="campaignSession" plainText />
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
            onClick={() => navigate(sessionTarget)}
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
