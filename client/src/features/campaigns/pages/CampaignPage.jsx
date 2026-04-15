import React from 'react';

import useCampaignPageController from '../hooks/useCampaignPageController';
import CampaignLayout from '../components/layout/CampaignLayout';
import CampaignNavigation, { TABS } from '../components/navigation/CampaignNavigation';
import CampaignSessionsWidget from '../components/widgets/CampaignSessionsWidget';
import CampaignInfoWidget from '../components/widgets/CampaignInfoWidget';
import CampaignSettingsWidget from '../components/widgets/CampaignSettingsWidget';
import CampaignMembersWidget from '../components/widgets/CampaignMembersWidget';
import CampaignCreateSessionWidget from '../components/widgets/CampaignCreateSessionWidget';
import CampaignPreviewWidget from '../components/widgets/CampaignPreviewWidget';
import { UserProfilePreview } from '@/components/shared';
import FullPageLoader from '@/components/shared/FullPageLoader';
import ErrorScreen from '@/components/shared/ErrorScreen';
import Button from '@/components/ui/Button';

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
    canReadMembers,
    canManageCampaignSettings,
    canAssignCampaignRoles,
    canModerateJoinRequests,
    canRemovePlayers,
    canCreateCampaignSessions,
    canManageShareLink,
    canUseOwnerSessionOverrides,
    isCampaignFinished,
    canJoin,
    pendingRequestStatus,
    currentShareLink,
    handleJoinRequest,
    handleLeave,
    handleRefreshCampaign,
    handleRegenerateShareLink,
    handleCopyShareLink,
    handleSaveSettings,
    handleTransferOwnership,
    handleCancelForeignSession,
    handleDeleteForeignSession,
    handleViewProfile,
    handleBackFromProfile,
    navigate,
  } = useCampaignPageController();

  if (error) {
    return (
      <ErrorScreen
        message={error}
        onAction={() => navigate('/')}
        actionLabel="На головну"
      />
    );
  }

  if (!currentCampaign) {
    return <FullPageLoader text="Завантаження кампанії..." />;
  }

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
          pendingRequestStatus={pendingRequestStatus}
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
              onTransferOwnership={handleTransferOwnership}
              canTransferOwnership={isOwner}
              isLoading={isLoading}
            />
          );
        }
        return (
          <CampaignSessionsWidget
            campaign={currentCampaign}
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
            canManageShareLink={canManageShareLink}
            currentShareLink={currentShareLink}
            onLeave={handleLeave}
            onRegenerateShareLink={handleRegenerateShareLink}
            onCopyShareLink={handleCopyShareLink}
            isLoading={isLoading}
          />
        );

      case TABS.SESSIONS:
      default:
        return (
          <CampaignSessionsWidget
            campaign={currentCampaign}
            canOwnerOverride={canUseOwnerSessionOverrides}
            onCancelForeignSession={handleCancelForeignSession}
            onDeleteForeignSession={handleDeleteForeignSession}
            onSessionCreated={handleRefreshCampaign}
          />
        );
    }
  };

  const renderRightPanel = () => {
    if (!isPreviewMode && activeTab === TABS.SESSIONS && !viewingUserId) {
      return (
        <CampaignCreateSessionWidget
          campaignId={id}
          canCreateSessions={canCreateCampaignSessions}
          isCampaignFinished={isCampaignFinished}
          onSessionCreated={handleRefreshCampaign}
        />
      );
    }

    return (
      <CampaignMembersWidget
        campaignId={id}
        initialMembers={campaignMembers}
        canReadMembers={canReadMembers}
        isOwner={isOwner}
        isGM={isGM}
        canAssignRoles={canAssignCampaignRoles}
        canModerateRequests={canModerateJoinRequests}
        canRemovePlayers={canRemovePlayers}
        currentUserId={user?.id}
        onViewProfile={handleViewProfile}
      />
    );
  };

  return (
    <CampaignLayout
      topBar={
        isPreviewMode ? (
          <nav className="flex items-center gap-4 justify-between w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="bg-white px-4 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2">
                <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-brand-accent font-bold text-xs">
                  D20
                </div>
                <span className="font-bold text-brand-dark hidden md:block">
                  TTRPG Platform
                </span>
              </div>
              <span className="text-white/40 hidden sm:inline">/</span>
              <span className="text-white font-bold text-sm truncate">
                {currentCampaign.title}
              </span>
            </div>
            <div className="flex items-center justify-end flex-1">
              <Button
                onClick={() => navigate('/')}
                variant="topbar"
                size="md"
                fullWidth={false}
              >
                На головну
              </Button>
            </div>
          </nav>
        ) : (
          <CampaignNavigation
            campaignTitle={currentCampaign.title}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            canManageSettings={canManageCampaignSettings}
          />
        )
      }
      leftPanel={renderLeftPanel()}
      rightPanel={renderRightPanel()}
    />
  );
}
