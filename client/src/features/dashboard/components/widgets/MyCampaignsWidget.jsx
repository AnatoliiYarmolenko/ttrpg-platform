import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyCampaignsQuery } from '../../hooks/useDashboardQueries';
import useDashboardStore from '@/stores/useDashboardStore';
import { PANEL_MODES } from '@/stores/dashboardConstants';
import DashboardCard from '@/components/ui/DashboardCard';
import Button from '@/components/ui/Button';
import { RoleBadge, EmptyState } from '@/components/shared';
import useAuthStore from '@/stores/useAuthStore';
import Dice20 from '@/components/ui/icons/Dice20';
import GroupPeople from '@/components/ui/icons/GroupPeople';
import Data from '@/components/ui/icons/Data';

/**
 * Віджет списку моїх кампаній
 */
export default function MyCampaignsWidget() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { setRightPanelMode } = useDashboardStore();

  const { data: campaigns = [], isLoading, error } = useMyCampaignsQuery('all');

  // Визначення ролі користувача в кампанії
  const getUserRole = (campaign) => {
    if (!user) return null;
    if (campaign.ownerId === user.id) return 'OWNER';
    const myMembership = campaign.members?.find(m => m.userId === user.id);
    return myMembership?.role || null;
  };

  const handleCampaignClick = (campaignId) => {
    navigate(`/campaign/${campaignId}`);
  };

  const handleCreateClick = () => {
    setRightPanelMode(PANEL_MODES.CREATE_CAMPAIGN);
  };

  let content;

  if (isLoading) {
    content = (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-[#164A41]">Завантаження...</div>
      </div>
    );
  } else if (error) {
    content = (
      <div className="flex flex-col items-center justify-center h-full text-red-500">
        <p>{error}</p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto min-h-0">
          {campaigns.length === 0 ? (
            <EmptyState
              icon={<Dice20 className="w-14 h-14" />}
              title="Немає кампаній"
              description=" "
              className="h-full"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {campaigns.map((campaign) => {
                const role = getUserRole(campaign);

                return (
                  <button
                    key={campaign.id}
                    onClick={() => handleCampaignClick(campaign.id)}
                    className="w-full text-left p-4 border-2 border-[#9DC88D]/30 rounded-xl hover:border-[#164A41]/30 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <h4 className="font-bold text-[#164A41] truncate">{campaign.title}</h4>
                      </div>
                      {role && <RoleBadge role={role} />}
                    </div>

                    {/* Опис */}
                    {campaign.description && (
                      <p className="text-sm text-[#4D774E] mb-2 line-clamp-2">
                        {campaign.description}
                      </p>
                    )}

                    {/* Статистика */}
                    <div className="flex items-center gap-4 text-sm text-[#4D774E]">
                      {campaign.system && <span className="flex items-center gap-1"><Dice20 className="w-4 h-4" /> {campaign.system}</span>}
                      <span className="flex items-center gap-1"><GroupPeople className="w-4 h-4" /> {campaign.membersCount || campaign.members?.length || 0}</span>
                      <span className="flex items-center gap-1"><Data className="w-4 h-4" /> {campaign.sessionsCount || campaign.sessions?.length || 0} сесій</span>
                    </div>

                    {/* Заявки (якщо власник/GM і є pending) */}
                    {campaign.joinRequests?.length > 0 && (
                      <div className="mt-2 px-2 py-1 bg-[#F1B24A]/20 rounded-lg text-sm text-[#164A41]">
                        {campaign.joinRequests.length} заявок на приєднання
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-[#9DC88D]/20 mt-auto flex-shrink-0">
          <Button onClick={handleCreateClick} variant="primary" className="flex items-center justify-center gap-2">
            Створити нову кампанію
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardCard 
      title="Мої кампанії"
    >
      {content}
    </DashboardCard>
  );
}
