import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import {
  StatusBadge,
  RoleBadge,
  DateTimeDisplay,
  EmptyState,
} from '@/components/shared';
import { useMySessionsQuery } from '../../hooks/useDashboardQueries';
import Dice20 from '@/components/ui/icons/Dice20';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';

/** Картка сесії — використовується і для one-shot і для сесій кампанії */
function SessionCard({ session, navigate, formatDuration }) {
  return (
    <button
      onClick={() => navigate(`/session/${session.id}`)}
      className="w-full text-left p-4 border-2 border-brand-light/30 rounded-xl hover:border-brand-dark/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-bold text-brand-dark truncate">{session.title}</h4>
        <StatusBadge status={session.status} size="sm" />
      </div>
      <div className="flex items-center gap-3 text-sm text-brand-medium mt-1 flex-wrap">
        {session.myRole && <RoleBadge role={session.myRole} />}
        <span className="flex items-center gap-1">
          <Data className="w-4 h-4" /> <DateTimeDisplay value={session.date} format="short" />
        </span>
        <span className="flex items-center gap-1">
          <Timer className="w-4 h-4" /> <DateTimeDisplay value={session.date} format="time" />
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
    date: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    duration: PropTypes.number,
    currentPlayers: PropTypes.number,
    maxPlayers: PropTypes.number,
  }).isRequired,
  navigate: PropTypes.func.isRequired,
  formatDuration: PropTypes.func.isRequired,
};

/**
 * MyGamesListWidget — ліва панель для "Мої сесії" view.
 *
 * Два розділи:
 * 1. Сесії в кампаніях (згруповані по кампанії)
 * 2. Мої сесії (one-shot)
 */
export default function MyGamesListWidget() {
  const navigate = useNavigate();

  const { data: sessions = [], isLoading: isLoadingSessions, error } = useMySessionsQuery();
  const isLoading = isLoadingSessions;

  // Розбиваємо сесії на one-shot та сесії всередині кампаній
  const oneShotSessions = sessions.filter((s) => !s.campaignId);
  const campaignSessions = sessions.filter((s) => !!s.campaignId);

  // Групуємо сесії кампаній за кампанією
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

  // Форматування тривалості
  const formatDuration = (minutes) => {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} хв`;
    if (mins === 0) return `${hours} год`;
    return `${hours} год ${mins} хв`;
  };

  if (isLoading) {
    return (
      <DashboardCard title="Мої сесії">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border-2 border-gray-100 rounded-xl space-y-2">
              <div className="h-5 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </DashboardCard>
    );
  }

  if (error) {
    return (
      <DashboardCard title="Мої сесії">
        <EmptyState
          title="Не вдалося завантажити сесії"
          description={error?.message || 'Спробуйте оновити сторінку ще раз'}
          className="h-full"
        />
      </DashboardCard>
    );
  }

  if (isEmpty) {
    return (
      <DashboardCard title="Мої сесії">
        <EmptyState
          icon={<Dice20 className="w-10 h-10" />}
          title="У вас ще немає сесій"
          description="Приєднайтесь до сесії або створіть свою на вкладці Календар"
          className="h-full"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Мої сесії">
      <div className="flex flex-col gap-6">
        {/* === Розділ: Сесії в кампаніях === */}
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

        {/* === Розділ: Мої сесії (one-shot) === */}
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
    </DashboardCard>
  );
}
