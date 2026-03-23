import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardCard from '@/components/ui/DashboardCard';
import {
  StatusBadge,
  RoleBadge,
  DateTimeDisplay,
  EmptyState,
} from '@/components/shared';
import { useMyCampaignsQuery, useMySessionsQuery } from '../../hooks/useDashboardQueries';
import Dice20 from '@/components/ui/icons/Dice20';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Data from '@/components/ui/icons/Data';
import Timer from '@/components/ui/icons/Timer';

/** Картка сесії — використовується і для one-shot і для сесій кампанії */
function SessionCard({ session, navigate, formatDuration }) {
  return (
    <button
      onClick={() => navigate(`/session/${session.id}`)}
      className="w-full text-left p-4 border-2 border-[#9DC88D]/30 rounded-xl hover:border-[#164A41]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between mb-1">
        <h4 className="font-bold text-[#164A41] truncate">{session.title}</h4>
        <StatusBadge status={session.status} size="sm" />
      </div>
      <div className="flex items-center gap-3 text-sm text-[#4D774E] mt-1 flex-wrap">
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

/**
 * MyGamesListWidget — ліва панель для "Мої ігри" view.
 *
 * Три розділи:
 * 1. Мої кампанії
 * 2. Сесії в кампаніях (згруповані по кампанії)
 * 3. Мої сесії (one-shot)
 */
export default function MyGamesListWidget() {
  const navigate = useNavigate();

  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useMyCampaignsQuery('all');
  const { data: sessions = [], isLoading: isLoadingSessions } = useMySessionsQuery();
  const isLoading = isLoadingCampaigns || isLoadingSessions;

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

  const isEmpty = campaigns.length === 0 && oneShotSessions.length === 0 && campaignSessions.length === 0;

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
      <DashboardCard title="Мої ігри">
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

  if (isEmpty) {
    return (
      <DashboardCard title="Мої ігри">
        <EmptyState
          icon={<Dice20 className="w-10 h-10" />}
          title="У вас ще немає ігор"
          description="Приєднайтесь до сесії або створіть свою на вкладці Головна"
          className="h-full"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title="Мої ігри">
      <div className="flex flex-col gap-6">
        {/* === Розділ: Мої кампанії === */}
        {campaigns.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-[#164A41] mb-3 flex items-center gap-2">
              Мої кампанії
            </h3>
            <div className="flex flex-col gap-2">
              {campaigns.map((campaign) => {
                const myRole = campaign.myRole;
                const membersCount = campaign.membersCount || campaign.members?.length || 0;

                return (
                  <button
                    key={campaign.id}
                    onClick={() => navigate(`/campaign/${campaign.id}`)}
                    className="w-full text-left p-4 border-2 border-[#9DC88D]/30 rounded-xl hover:border-[#164A41]/40 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="font-bold text-[#164A41] flex items-center gap-2">
                        <span className="truncate">{campaign.title}</span>
                      </h4>
                      <StatusBadge status={campaign.status || 'ACTIVE'} size="sm" />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[#4D774E] mt-1">
                      <RoleBadge role={myRole} />
                      <span className="flex items-center gap-1">
                        <GroupPeople className="w-4 h-4" /> {membersCount} учасників
                      </span>
                      {campaign.system && (
                        <span className="text-xs px-2 py-0.5 bg-[#9DC88D]/20 rounded">
                          {campaign.system}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* === Розділ: Сесії в кампаніях === */}
        {campaignGroups.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-[#164A41] mb-3">
              Сесії в кампаніях
            </h3>
            <div className="flex flex-col gap-4">
              {campaignGroups.map((group) => (
                <div key={group.id}>
                  <p className="text-sm font-semibold text-[#4D774E] mb-2 pl-1">{group.title}</p>
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
            <h3 className="text-lg font-bold text-[#164A41] mb-3 flex items-center gap-2">
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
