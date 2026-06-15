import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import {
  StatusBadge,
  RoleBadge,
  DateTimeDisplay,
  EmptyState,
  SkeletonSessionCard,
  SegmentedToggle,
} from '@/components/shared';
import { useMySessionsQuery } from '../../hooks/useDashboardQueries';

const SESSION_FILTER_OPTIONS = [
  { key: 'ACTIVE', label: 'Активні' },
  { key: 'PLANNED', label: 'Заплановані' },
  { key: 'FINISHED', label: 'Завершені' },
  { key: 'CANCELED', label: 'Скасовані' },
];

const SESSION_EMPTY_DESCRIPTIONS = {
  ACTIVE: 'Зараз немає активних сесій',
  PLANNED: 'Заплановані сесії відображатимуться тут',
  FINISHED: 'Завершені сесії відображатимуться тут',
  CANCELED: 'Скасовані сесії відображатимуться тут',
};
import Dice20 from '@/components/ui/icons/Dice20';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';

function SessionCard({ session, navigate, formatDuration }) {
  const isPending = session.myStatus === 'PENDING';

  return (
    <button
      onClick={() => navigate(`/session/${session.id}`)}
      className="w-full text-left p-4 border-2 border-brand-light/30 rounded-xl hover:border-brand-dark/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-1 gap-2">
        <h4 className="font-bold text-brand-dark truncate flex-1">{session.title}</h4>
        <div className="flex items-center gap-1 shrink-0">
          {isPending && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded border border-yellow-200">
              Заявка
            </span>
          )}
          <StatusBadge status={session.status} size="sm" />
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-brand-medium mt-1 flex-wrap">
        {session.myRole && !isPending && <RoleBadge role={session.myRole} />}
        {isPending && (
          <span className="text-yellow-700 text-xs">Очікує підтвердження</span>
        )}
        <span className="flex items-center gap-1">
          <Data className="w-4 h-4" /> <DateTimeDisplay value={session.startAt} format="short" />
        </span>
        <span className="flex items-center gap-1">
          <Timer className="w-4 h-4" /> <DateTimeDisplay value={session.startAt} format="time" />
        </span>
        {session.duration && (
          <span className="flex items-center gap-1">
            <Timer className="w-4 h-4" /> {formatDuration(session.duration)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <GroupPeople className="w-4 h-4" /> {session.currentPlayers}/{session.maxPlayers}
        </span>
      </div>
    </button>
  );
}

SessionCard.propTypes = {
  session: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string.isRequired,
    status: PropTypes.string,
    myRole: PropTypes.string,
    myStatus: PropTypes.string,
    startAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    duration: PropTypes.number,
    currentPlayers: PropTypes.number,
    maxPlayers: PropTypes.number,
  }).isRequired,
  navigate: PropTypes.func.isRequired,
  formatDuration: PropTypes.func.isRequired,
};
export default function MyGamesListWidget() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('PLANNED');

  const { data: allSessions = [], isLoading: isLoadingSessions, error } = useMySessionsQuery();
  const isLoading = isLoadingSessions;

  const sessions = allSessions.filter((s) => s.status === statusFilter);

  const oneShotSessions = sessions.filter((s) => !s.campaignId);
  const campaignSessions = sessions.filter((s) => !!s.campaignId);

  const sessionsByCampaign = campaignSessions.reduce((acc, session) => {
    const key = session.campaignId;
    if (!acc[key]) {
      acc[key] = { id: key, title: session.campaign?.title || `Кампанія #${key}`, sessions: [] };
    }
    acc[key].sessions.push(session);
    return acc;
  }, {});
  const campaignGroups = Object.values(sessionsByCampaign);

  const isEmpty = oneShotSessions.length === 0 && campaignSessions.length === 0;

  const formatDuration = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} хв`;
    if (mins === 0) return `${hours} год`;
    return `${hours} год ${mins} хв`;
  };

  let innerContent;

  if (isLoading) {
    innerContent = (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <SkeletonSessionCard key={i} />)}
      </div>
    );
  } else if (error) {
    innerContent = (
      <EmptyState
        title="Не вдалося завантажити сесії"
        description={error?.message || 'Спробуйте оновити сторінку ще раз'}
        className="h-full"
      />
    );
  } else if (allSessions.length === 0) {
    innerContent = (
      <EmptyState
        icon={<Dice20 className="w-10 h-10" />}
        title="У вас ще немає сесій"
        description="Приєднайтесь до сесії або створіть свою на вкладці Календар"
        className="h-full"
      />
    );
  } else if (isEmpty) {
    innerContent = (
      <EmptyState
        icon={<Dice20 className="w-10 h-10" />}
        title="Немає сесій"
        description={SESSION_EMPTY_DESCRIPTIONS[statusFilter]}
        className="h-full"
      />
    );
  } else {
    innerContent = (
      <div className="flex flex-col gap-6">
        {campaignGroups.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-brand-dark mb-3">
              Сесії в кампаніях
            </h3>
            <div className="flex flex-col gap-4">
              {campaignGroups.map((group) => (
                <div key={group.id}>
                  <p className="text-sm font-semibold text-brand-medium mb-2 pl-1">{group.title}</p>
                  <div className="flex flex-col gap-2">
                    {group.sessions.map((session) => (
                      <SessionCard key={session.id} session={session} navigate={navigate} formatDuration={formatDuration} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {oneShotSessions.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-brand-dark mb-3 flex items-center gap-2">
              <Dice20 className="w-5 h-5" /> Мої сесії (one-shot)
            </h3>
            <div className="flex flex-col gap-2">
              {oneShotSessions.map((session) => (
                <SessionCard key={session.id} session={session} navigate={navigate} formatDuration={formatDuration} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <DashboardCard title="Мої сесії">
      <div className="flex flex-col h-full">
        <SegmentedToggle
          options={SESSION_FILTER_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          className="mb-4 flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto min-h-0">
          {innerContent}
        </div>
      </div>
    </DashboardCard>
  );
}
