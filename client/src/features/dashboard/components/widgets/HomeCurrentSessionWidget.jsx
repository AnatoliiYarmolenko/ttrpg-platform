import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import { DateTimeDisplay, EmptyState, RoleBadge, SessionTimeBadge } from '@/components/shared';
import Dice20 from '@/components/ui/icons/Dice20';
import Data from '@/components/ui/icons/Data';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Timer from '@/components/ui/icons/Timer';
import { DASHBOARD_URL_PARAMS, VIEW_MODES } from '@/features/dashboard/constants';
import { useNextRelevantSessionQuery } from '../../hooks/useDashboardQueries';
import { setOrDeleteParam, updateSearchParams } from '@/utils/urlState';
import { SESSION_VISIBILITY_LABELS } from '@/features/sessions/constants/visibility';

const UI_LOCALE = 'uk-UA';

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

const getCardTitle = (session) => (session?.status === 'ACTIVE' ? 'Поточна сесія' : 'Наступна сесія');



export default function HomeCurrentSessionWidget() {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const handleGoToSearch = () => {
    updateSearchParams(setSearchParams, (next) => {
      setOrDeleteParam(next, DASHBOARD_URL_PARAMS.TAB, VIEW_MODES.SEARCH, VIEW_MODES.HOME);
      next.delete(DASHBOARD_URL_PARAMS.SECTION);
    });
  };

  const handleChooseSession = () => {
    updateSearchParams(setSearchParams, (next) => {
      setOrDeleteParam(next, DASHBOARD_URL_PARAMS.TAB, VIEW_MODES.CALENDAR, VIEW_MODES.HOME);
      next.delete(DASHBOARD_URL_PARAMS.SECTION);
    });
  };

  const {
    data: session,
    isLoading,
    isError,
    refetch,
  } = useNextRelevantSessionQuery(true);

  // Автоматично оновити запит, якщо запланована сесія вже почалась (за часом)
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

  const cardTitle = getCardTitle(session);

  const playersCount = Number.isFinite(Number(session?.currentPlayers))
    ? Number(session.currentPlayers)
    : 0;
  const playersCapacity = Number(session?.maxPlayers);
  const hasPlayersCapacity = Number.isFinite(playersCapacity) && playersCapacity > 0;
  const isCampaignSession = Boolean(session?.campaign?.id || session?.campaignId);
  const visibilityLabels = isCampaignSession
    ? SESSION_VISIBILITY_LABELS.CAMPAIGN
    : SESSION_VISIBILITY_LABELS.ONE_SHOT;
  const availabilityLabel = visibilityLabels[session?.visibility]
    || (isCampaignSession
      ? SESSION_VISIBILITY_LABELS.CAMPAIGN.PRIVATE
      : SESSION_VISIBILITY_LABELS.ONE_SHOT.PRIVATE);
  const campaignLink = session?.campaign?.canOpenDirectly && session?.campaign?.id
    ? `/campaign/${session.campaign.id}`
    : null;

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
            description={'Спробуйте ще раз'}
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
          {/* SessionTimeBadge manages its own update timer internally */}
          <SessionTimeBadge session={session} />
        </div>

        <div className="flex items-center justify-between gap-3">
            <div className="text-brand-medium text-sm leading-tight truncate flex-1 min-w-0">
              {session.campaign?.title ? (
                <>
                  <span className="font-medium">Кампанія:</span>{' '}
                  {campaignLink ? (
                    <Link to={campaignLink} className="underline hover:no-underline">
                      {session.campaign.title}
                    </Link>
                  ) : (
                    session.campaign.title
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium">Формат:</span> One-shot
                </>
              )}
            </div>

            <div className="shrink-0 flex justify-end">
              {session.myRole && <RoleBadge role={session.myRole} size="md" />}
            </div>
        </div>

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
