import React from 'react';

// Controller hook — вся логіка сторінки інкапсульована тут
import useCampaignPageController from '../hooks/useCampaignPageController';

// Layout & Navigation
import CampaignLayout from '../components/layout/CampaignLayout';
import CampaignNavigation, { TABS } from '../components/navigation/CampaignNavigation';

// Widgets
import CampaignSessionsWidget from '../components/widgets/CampaignSessionsWidget';
import CampaignInfoWidget from '../components/widgets/CampaignInfoWidget';
import CampaignSettingsWidget from '../components/widgets/CampaignSettingsWidget';
import CampaignMembersWidget from '../components/widgets/CampaignMembersWidget';
import CampaignPreviewWidget from '../components/widgets/CampaignPreviewWidget';

// Shared
import { UserProfilePreview } from '@/components/shared';
import FullPageLoader from '@/components/shared/FullPageLoader';
import ErrorScreen from '@/components/shared/ErrorScreen';

/**
 * CampaignPage — тонкий shell-компонент для /campaign/:id.
 *
 * Вся логіка (завантаження, ролі, дії) делегується в useCampaignPageController.
 * Компонент відповідає лише за:
 * - підключення до layout
 * - вибір віджетів за станом
 */
export default function CampaignPage() {
  const {
    id,
    user,
    currentCampaign,
    campaignMembers,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    viewingUserId,
    isPreviewMode,
    myRole,
    isOwner,
    isGM,
    canManageCampaignSettings,
    canAssignCampaignRoles,
    canModerateJoinRequests,
    canRemovePlayers,
    canCreateCampaignSessions,
    canDeleteCampaign,
    canManageInviteCode,
    canUseOwnerSessionOverrides,
    canJoin,
    handleJoinRequest,
    handleLeave,
    handleRefreshCampaign,
    handleRegenerateCode,
    handleSaveSettings,
    handleDelete,
    handleTransferOwnership,
    handleCancelForeignSession,
    handleDeleteForeignSession,
    handleViewProfile,
    handleBackFromProfile,
    navigate,
  } = useCampaignPageController();

  // === Error state ===
  if (error) {
    return (
      <ErrorScreen
        message={error}
        onAction={() => navigate('/')}
        actionLabel="На головну"
      />
    );
  }

  // === Loading state ===
  if (!currentCampaign) {
    return <FullPageLoader text="Завантаження кампанії..." />;
  }

  // === Left panel ===
  const renderLeftPanel = () => {
    if (viewingUserId) {
      return (
        <UserProfilePreview
          userId={viewingUserId}
          onBack={handleBackFromProfile}
          participants={campaignMembers.map((m) => ({ ...m, user: m.user }))}
        />
      );
    }

    if (isPreviewMode) {
      return (
        <CampaignPreviewWidget
          campaign={currentCampaign}
          onJoinRequest={handleJoinRequest}
          canJoin={canJoin}
          isLoading={isLoading}
        />
      );
    }

    switch (activeTab) {
      case TABS.SETTINGS:
        if (canManageCampaignSettings) {
          return (
            <CampaignSettingsWidget
              campaign={currentCampaign}
              onSave={handleSaveSettings}
              onDelete={handleDelete}
              onTransferOwnership={handleTransferOwnership}
              canDelete={canDeleteCampaign}
              canTransferOwnership={isOwner}
              isLoading={isLoading}
            />
          );
        }
        return (
          <CampaignSessionsWidget
            campaign={currentCampaign}
            canCreateSessions={canCreateCampaignSessions}
            canOwnerOverride={canUseOwnerSessionOverrides}
            onCancelForeignSession={handleCancelForeignSession}
            onDeleteForeignSession={handleDeleteForeignSession}
            onSessionCreated={handleRefreshCampaign}
          />
        );

      case TABS.DETAILS:
        return (
          <CampaignInfoWidget
            campaign={currentCampaign}
            myRole={myRole}
            canManageInviteCode={canManageInviteCode}
            onLeave={handleLeave}
            onRegenerateCode={handleRegenerateCode}
            isLoading={isLoading}
          />
        );

      case TABS.SESSIONS:
      default:
        return (
          <CampaignSessionsWidget
            campaign={currentCampaign}
            canCreateSessions={canCreateCampaignSessions}
            canOwnerOverride={canUseOwnerSessionOverrides}
            onCancelForeignSession={handleCancelForeignSession}
            onDeleteForeignSession={handleDeleteForeignSession}
            onSessionCreated={handleRefreshCampaign}
          />
        );
    }
  };

  // === Right panel ===
  const renderRightPanel = () => (
    <CampaignMembersWidget
      campaignId={id}
      isOwner={isOwner}
      isGM={isGM}
      canAssignRoles={canAssignCampaignRoles}
      canModerateRequests={canModerateJoinRequests}
      canRemovePlayers={canRemovePlayers}
      currentUserId={user?.id}
      onViewProfile={handleViewProfile}
    />
  );

  return (
    <CampaignLayout
      topBar={
        !isPreviewMode ? (
          <CampaignNavigation
            campaignTitle={currentCampaign.title}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            canManageSettings={canManageCampaignSettings}
          />
        ) : (
          <nav className="flex items-center gap-4 justify-between w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="bg-white px-4 py-2 rounded-xl border-2 border-[#9DC88D]/30 shadow-md flex items-center gap-2">
                <div className="w-6 h-6 bg-[#164A41] rounded-full flex items-center justify-center text-[#F1B24A] font-bold text-xs">
                  D20
                </div>
                <span className="font-bold text-[#164A41] hidden md:block">
                  TTRPG Platform
                </span>
              </div>
              <span className="text-white/40 hidden sm:inline">/</span>
              <span className="text-white font-bold text-sm truncate">
                {currentCampaign.title}
              </span>
            </div>
            <div className="flex items-center justify-end flex-1">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-xl border-2 border-white/50 bg-[#164A41] text-white hover:bg-[#F1B24A] hover:text-[#164A41] hover:border-[#164A41] transition-all font-bold shadow-lg"
              >
                На головну
              </button>
            </div>
          </nav>
        )
      }
      leftPanel={renderLeftPanel()}
      rightPanel={renderRightPanel()}
    />
  );
}
