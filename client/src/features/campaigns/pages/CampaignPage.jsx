import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

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
import { useChatController } from '@/features/chat/hooks';

export default function CampaignPage() {
  const location = useLocation();
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
    shouldRedirectToLogin,
    activeTab,
    availableTabs,
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
    isCampaignFinished,
    canJoin,
    canCancelJoinRequest,
    pendingRequestStatus,
    currentShareLink,
    isUpdatingSettings,
    isRegeneratingShareLink,
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

  const chatController = useChatController('campaign', Number.parseInt(id, 10), {
    enabled: Boolean(user && id && !isPreviewMode),
  });

  React.useEffect(() => {
    const disconnect = chatController?.disconnect;
    return () => {
      disconnect?.();
    };
  }, [chatController?.disconnect]);

  if (shouldRedirectToLogin) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

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
            <EmptyState
              icon={<GroupPeople className="w-12 h-12" />}
              title="Список учасників прихований"
              description="Для цього режиму перегляду список учасників недоступний."
              fullHeight
            />
          </DashboardCard>
        ),
        leftLabel: 'Деталі кампанії',
        rightLabel: 'Учасники',
      };
    }

    return CampaignTabRenderer({
      activeTab,
      viewingUserId,
      profilePreviewNode,
      chatProps: chatController.chatPanelProps,
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
        onCreateSession: () => {},
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
        isLoading: isLoading || isUpdatingSettings,
        isRegeneratingShareLink,
      },
    });
  };

  const { leftPanel, rightPanel, leftLabel, rightLabel } = renderContent();

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
      leftLabel={leftLabel}
      rightLabel={rightLabel}
    />
  );
}
