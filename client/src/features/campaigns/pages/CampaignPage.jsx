import React from 'react';

import useCampaignPageController from '../hooks/useCampaignPageController';
import CampaignLayout from '../components/layout/CampaignLayout';
import CampaignNavigation from '../components/navigation/CampaignNavigation';
import CampaignPreviewWidget from '../components/widgets/CampaignPreviewWidget';
import CampaignTabRenderer from '../components/layout/CampaignTabRenderer';
import { UserProfilePreview, EmptyState, BrandLogo } from '@/components/shared';
import FullPageLoader from '@/components/shared/FullPageLoader';
import ErrorScreen from '@/components/shared/ErrorScreen';
import Button from '@/components/ui/Button';
import DashboardCard from '@/components/ui/DashboardCard';
import GroupPeople from '@/components/ui/icons/GroupPeople';

export default function CampaignPage() {
  const {
    id,
    routeShareToken,
    user,
    currentCampaign,
    membersSection,
    joinRequestsSection,
    sessionsSection,
    isLoading,
    error,
    activeTab,
    availableTabs,
    setActiveTab,
    campaignCommunicationMode,
    setCampaignCommunicationMode,
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
    isCampaignFinished,
    canJoin,
    canCancelJoinRequest,
    pendingRequestStatus,
    currentShareLink,
    handleJoinRequest,
    handleCancelJoinRequest,
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

  const renderContent = () => {
    const profilePreviewNode = viewingUserId ? (
      <UserProfilePreview
        userId={viewingUserId}
        onBack={handleBackFromProfile}
        participants={(membersSection.items || []).map((member) => ({ ...member, user: member.user }))}
      />
    ) : null;

    if (isPreviewMode) {
      return {
        leftPanel: (
          <CampaignPreviewWidget
            campaign={currentCampaign}
            onJoinRequest={handleJoinRequest}
            onCancelJoinRequest={handleCancelJoinRequest}
            canJoin={canJoin}
            canCancelJoinRequest={canCancelJoinRequest}
            pendingRequestStatus={pendingRequestStatus}
            isLoading={isLoading}
          />
        ),
        rightPanel: (
          <DashboardCard title="Учасники">
            <div className="flex flex-col items-center justify-center h-full min-h-[300px]">
              <EmptyState
                icon={<GroupPeople className="w-12 h-12" />}
                title="Список учасників прихований"
                description="Для цього режиму перегляду список учасників недоступний."
              />
            </div>
          </DashboardCard>
        ),
      };
    }

    return CampaignTabRenderer({
      activeTab,
      campaignCommunicationMode,
      setCampaignCommunicationMode,
      viewingUserId,
      profilePreviewNode,
      infoProps: {
        campaign: currentCampaign,
        myRole,
        onLeave: handleLeave,
        isCampaignFinished,
      },
      membersProps: {
        campaignId: id,
        membersSection,
        joinRequestsSection,
        canReadMembers,
        isOwner,
        isGM,
        canAssignRoles: canAssignCampaignRoles,
        canModerateRequests: canModerateJoinRequests,
        canRemovePlayers,
        currentUserId: user?.id,
        onViewProfile: handleViewProfile,
      },
      nextSessionProps: {
        sessions: sessionsSection.items,
        campaignTitle: currentCampaign.title,
        campaignNavigationTarget: null,
        campaignShareToken: routeShareToken || null,
        campaignId: id,
        canCreateSessions: canCreateCampaignSessions,
        isCampaignFinished,
        onCreateSession: () => {}, // Handled directly in right panel header now
      },
      sessionsProps: {
        campaignId: id,
        campaignStatus: currentCampaign.status,
        sessionsSection,
        campaignShareToken: routeShareToken || null,
        canCreateSessions: canCreateCampaignSessions,
        isCampaignFinished,
        onCancelSession: handleCancelForeignSession,
        onDeleteSession: handleDeleteForeignSession,
        onSessionCreated: handleRefreshCampaign,
      },
      settingsProps: {
        campaign: currentCampaign,
        myRole,
        canManageShareLink,
        currentShareLink,
        onLeave: handleLeave,
        onRegenerateShareLink: handleRegenerateShareLink,
        onCopyShareLink: handleCopyShareLink,
        onSave: handleSaveSettings,
        onTransferOwnership: handleTransferOwnership,
        canTransferOwnership: isOwner,
        isLoading,
      },
    });
  };

  const { leftPanel, rightPanel } = renderContent();

  return (
    <CampaignLayout
      topBar={
        isPreviewMode ? (
          <nav className="flex items-center gap-4 justify-between w-full">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <BrandLogo />
            </div>
            <div className="flex items-center justify-end flex-1">
              <Button
                onClick={() => navigate('/')}
                variant="topbar"
                size="md"
                fullWidth={false}
              >
                Назад
              </Button>
            </div>
          </nav>
        ) : (
          <CampaignNavigation
            campaignTitle={currentCampaign.title}
            activeTab={activeTab}
            availableTabs={availableTabs}
            onTabChange={setActiveTab}
            canManage={canManageCampaignSettings}
          />
        )
      }
      leftPanel={leftPanel}
      rightPanel={rightPanel}
    />
  );
}
