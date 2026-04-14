import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import { DateTimeDisplay, EmptyState, RoleBadge } from '@/components/shared';
import Dice20 from '@/components/ui/icons/Dice20';
import Data from '@/components/ui/icons/Data';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Timer from '@/components/ui/icons/Timer';
import useDashboardStore from '@/stores/useDashboardStore';
import { VIEW_MODES } from '@/stores/dashboardConstants';
import { useNextRelevantSessionQuery } from '../../hooks/useDashboardQueries';

const UI_LOCALE = 'uk-UA';
const DEFAULT_PLANNED_TOLERANCE_MINUTES = 2;

const formatStartAt = (value) => {
  if (!value) {
    return 'Дата не вказана';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Дата не вказана';
  }

  return date.toLocaleString(UI_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const selectRelativeUnit = (diffMs) => {
  const absMs = Math.abs(diffMs);

  if (absMs < 60 * 1000) {
    return { unit: 'second', value: Math.round(diffMs / 1000) };
  }

  if (absMs < 60 * 60 * 1000) {
    return { unit: 'minute', value: Math.round(diffMs / (60 * 1000)) };
  }

  if (absMs < 24 * 60 * 60 * 1000) {
    return { unit: 'hour', value: Math.round(diffMs / (60 * 60 * 1000)) };
  }

  return { unit: 'day', value: Math.round(diffMs / (24 * 60 * 60 * 1000)) };
};

const formatDelayedDuration = (lateMs) => {
  const totalMinutes = Math.max(1, Math.ceil(lateMs / (60 * 1000)));

  if (totalMinutes < 60) {
    return `${totalMinutes} хв`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return `${hours} год`;
  }

  return `${hours} год ${minutes} хв`;
};

const buildRelativeSessionTime = (session, nowMs) => {
  if (!session?.startAt) {
    return null;
  }

  const startDate = new Date(session.startAt);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  if (session.status === 'PLANNED') {
    const diffMs = startDate.getTime() - nowMs;
    const toleranceMinutes = Number(session?.plannedToleranceMinutes);
    const plannedToleranceMinutes = Number.isFinite(toleranceMinutes) && toleranceMinutes > 0
      ? toleranceMinutes
      : DEFAULT_PLANNED_TOLERANCE_MINUTES;
    const plannedToleranceMs = plannedToleranceMinutes * 60 * 1000;

    if (diffMs < 0) {
      if (diffMs < -plannedToleranceMs) {
        return 'Оновлюємо статус...';
      }

      return `Сесія запізнюється на: ${formatDelayedDuration(Math.abs(diffMs))}`;
    }

    if (diffMs <= 30 * 1000) {
      return 'Почнеться зовсім скоро';
    }

    const relativeTime = new Intl.RelativeTimeFormat(UI_LOCALE, { numeric: 'auto' });
    const { unit, value } = selectRelativeUnit(diffMs);
    return `Почнеться ${relativeTime.format(value, unit)}`;
  }

  if (session.status === 'ACTIVE') {
    return 'Сесія вже йде!';
  }

  return null;
};

const getCardTitle = (session) => (session?.status === 'ACTIVE' ? 'Поточна сесія' : 'Наступна сесія');

const VISIBILITY_LABELS = {
  PUBLIC: 'За заявкою',
  PRIVATE: 'Приватна',
  LINK_ONLY: 'За посиланням',
};

export default function HomeCurrentSessionWidget() {
  const navigate = useNavigate();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const setViewMode = useDashboardStore((state) => state.setViewMode);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setNowMs(Date.now());
    }, 30 * 1000);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  const handleGoToSearch = () => {
    setViewMode(VIEW_MODES.SEARCH);
  };

  const handleChooseSession = () => {
    setViewMode(VIEW_MODES.CALENDAR);
  };

  const {
    data: session,
    isLoading,
    isError,
    error,
    refetch,
  } = useNextRelevantSessionQuery(true);

  useEffect(() => {
    if (!session?.startAt || session.status !== 'PLANNED') {
      return;
    }

    const startMs = new Date(session.startAt).getTime();
    if (Number.isNaN(startMs) || Date.now() < startMs) {
      return;
    }

    refetch();
  }, [session, refetch]);

  const relativeSessionTime = useMemo(
    () => buildRelativeSessionTime(session, nowMs),
    [session, nowMs]
  );
  const cardTitle = getCardTitle(session);

  const playersCount = Number.isFinite(Number(session?.currentPlayers))
    ? Number(session.currentPlayers)
    : 0;
  const playersCapacity = Number(session?.maxPlayers);
  const hasPlayersCapacity = Number.isFinite(playersCapacity) && playersCapacity > 0;
  const availabilityLabel = VISIBILITY_LABELS[session?.visibility] || VISIBILITY_LABELS.PRIVATE;

  if (isLoading) {
    return (
      <DashboardCard title={cardTitle}>
        <div className="flex items-center justify-center h-full min-h-48">
          <div className="animate-pulse text-brand-dark font-medium">Завантаження...</div>
        </div>
      </DashboardCard>
    );
  }

  if (isError) {
    return (
      <DashboardCard title={cardTitle}>
        <div className="flex flex-col gap-4 h-full justify-center">
          <EmptyState
            title="Не вдалося завантажити сесію"
            description={error?.message || 'Спробуйте ще раз'}
            className="h-full"
          />
          <Button onClick={() => refetch()} variant="outline" fullWidth className="w-full">
            Оновити
          </Button>
        </div>
      </DashboardCard>
    );
  }

  if (!session) {
    return (
      <DashboardCard title={cardTitle}>
        <div className="flex flex-col gap-4 h-full">
          <EmptyState
            icon={<Dice20 className="w-14 h-14" />}
            title="Тут поки пусто"
            description="Перейдіть до пошуку або календаря"
            className="h-full"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto">
            <Button variant="outline" onClick={handleGoToSearch} fullWidth className="w-full">
              Пошук сесій
            </Button>
            <Button onClick={handleChooseSession} fullWidth className="w-full">
              Відкрити календар
            </Button>
          </div>
        </div>
      </DashboardCard>
    );
  }

  return (
  <DashboardCard title={cardTitle}>
    <div className="flex flex-col gap-4 h-full">
      <div className="flex flex-col gap-2">

        <div className="flex items-start justify-between gap-2">
          <h3 className="text-xl font-bold text-brand-dark leading-tight truncate flex-1 min-w-0">
            {session.title}
          </h3>
          {relativeSessionTime && (
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-brand-light/20 text-brand-dark text-sm font-medium whitespace-nowrap shrink-0">
              <Timer className="w-4 h-4 shrink-0" />
              <span>{relativeSessionTime}</span>
            </div>
          )}
        </div>

        {(session.campaign?.title || session.myRole) && (
          <div className="flex items-center justify-between gap-3">
            <div className="text-brand-medium text-sm leading-tight truncate flex-1 min-w-0">
              {session.campaign?.title && (
                <>
                  <span className="font-medium">Кампанія:</span> {session.campaign.title}
                </>
              )}
            </div>
            <div className="shrink-0 flex justify-end">
              {session.myRole && <RoleBadge role={session.myRole} size="md" />}
            </div>
          </div>
        )}

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 p-4 bg-brand-light/10 rounded-xl">
        <div className="flex items-center gap-2 text-brand-medium text-sm">
          <Data className="w-4 h-4 shrink-0" />
          <DateTimeDisplay value={session.startAt} format="long" fallback={formatStartAt(session.startAt)} />
        </div>
        <div className="flex items-center gap-2 text-brand-medium text-sm">
          <span className="font-medium">Система:</span>
          <span>{session.system || 'Не вказана'}</span>
        </div>

        <div className="flex items-center gap-2 text-brand-medium text-sm">
          <Timer className="w-4 h-4 shrink-0" />
          <time>{session.startAt ? new Date(session.startAt).toLocaleTimeString(UI_LOCALE, { hour: '2-digit', minute: '2-digit' }) : '--:--'}</time>
        </div>
        <div className="flex items-center gap-2 text-brand-medium text-sm">
          <span className="font-medium">Доступність:</span>
          <span>{availabilityLabel}</span>
        </div>

        <div className="flex items-center gap-2 text-brand-medium text-sm">
          <GroupPeople className="w-4 h-4 shrink-0" />
          <span>
            {hasPlayersCapacity ? `${playersCount} / ${playersCapacity} гравців` : `${playersCount} гравців`}
          </span>
        </div>
        {session.organizerName ? (
          <div className="flex items-center gap-2 text-brand-medium text-sm">
            <span className="font-medium">Організатор:</span>
            <span>{session.organizerName}</span>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      <div className="border-t border-brand-light/20 pt-3">
        <h4 className="text-sm font-bold text-brand-dark mb-3">Опис</h4>
        <p className="text-sm text-brand-medium whitespace-pre-wrap leading-relaxed">
          {session.description?.trim() || 'Опис відсутній'}
        </p>
      </div>

      <div className="mt-auto">
        <Button
          onClick={() => navigate(`/session/${session.id}`)}
          fullWidth
          className="w-full min-h-[43px]"
        >
          Перейти до сесії
        </Button>
      </div>
    </div>
  </DashboardCard>
);
}
