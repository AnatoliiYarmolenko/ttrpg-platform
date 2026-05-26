import React from 'react';
import { Navigate } from 'react-router-dom';

// Controller hook — вся логіка сторінки інкапсульована тут
import useSessionPageController from '../hooks/useSessionPageController';

// Layout & Navigation
import SessionLayout from '../components/layout/SessionLayout';
import SessionNavigation from '../components/navigation/SessionNavigation';
import SessionTabRenderer from '../components/layout/SessionTabRenderer';

// Widgets
import SessionPagePreviewWidget from '../components/widgets/SessionPreviewWidget';

// Shared
import { 
  UserProfilePreview, 
  BrandLogo, 
  FullPageLoader, 
  ErrorScreen 
} from '@/components/shared';

import Button from '@/components/ui/Button'; 
import { useChatController } from '@/features/chat/hooks';

/**
 * SessionPage — тонкий shell-компонент для /session/:id.
 *
 * Вся логіка (завантаження, ролі, дії) делегується в useSessionPageController.
 * Компонент відповідає лише за:
 * - підключення до layout
 * - вибір віджетів за станом
 */
export default function SessionPage() {
  const {
    id,
    user,
    currentSession,
    isLoading,
    error,
    shouldRedirectToLogin,
    activeTab,
    availableTabs,
    setActiveTab,
    communicationPanelMode,
    setCommunicationPanelMode,
    viewingUserId,
    isPreviewMode,
    myRole,
    canReadParticipants,
    canStartSession,
    canFinishSession,
    canCancelSession,
    canDeleteSession,
    canManageStatus,
    canManageParticipants,
    canManageGmRequests,
    canManageShareLink,
    canManageSettings,
    canManageSession,
    participantsSection,
    canJoin,
    canApplyAsGm,
    canLeave,
    showCampaignInfo,
    canNavigateToCampaignDirectly,
    campaignNavigationTarget,
    currentShareLink,
    handleJoin,
    handleLeave,
    handleStatusChange,
    handleMarkAsFinished,
    handleSaveSettings,
    handleDelete,
    handleRegenerateShareLink,
    handleCopyShareLink,
    handleViewProfile,
    handleBackFromProfile,
    navigate,
    viewer,
  } = useSessionPageController();

  if (shouldRedirectToLogin) {
    return <Navigate to="/login" replace />;
  }

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
  if (!currentSession) {
    return <FullPageLoader text="Завантаження сесії..." />;
  }

  // === Left panel ===
  const profilePreviewNode = viewingUserId ? (
    <UserProfilePreview
      userId={viewingUserId}
      onBack={handleBackFromProfile}
      participants={Array.isArray(participantsSection?.items) ? participantsSection.items : []}
    />
  ) : null;

  const sessionInfoProps = {
    session: currentSession,
    myRole,
    currentUserId: user?.id,
    canManage: canManageStatus,
    canStartSession,
    canFinishSession,
    canCancelSession,
    onLeave: handleLeave,
    canLeave,
    onStatusChange: handleStatusChange,
    onMarkAsFinished: handleMarkAsFinished,
    showCampaignInfo,
    canNavigateToCampaignDirectly,
    campaignNavigationTarget,
    isLoading,
  };

  const sessionSettingsProps = {
    session: currentSession,
    onSave: handleSaveSettings,
    onDelete: handleDelete,
    canManageSettings,
    canManageShareLink,
    currentShareLink,
    onRegenerateShareLink: handleRegenerateShareLink,
    onCopyShareLink: handleCopyShareLink,
    canDelete: canDeleteSession,
    isLoading,
  };

  const participantsProps = {
    sessionId: id,
    session: currentSession,
    participantsSection,
    canReadParticipants,
    canManage: canManageParticipants,
    canManageGmRequests,
    currentUserId: user?.id,
    onViewProfile: handleViewProfile,
    maxPlayers: currentSession.maxPlayers,
  };

  const tabPanels = SessionTabRenderer({
    activeTab,
    sessionInfoProps,
    sessionSettingsProps,
    participantsProps,
    viewingUserId,
    profilePreviewNode,
    communicationPanelMode,
    setCommunicationPanelMode,
chatProps: chatController.chatPanelProps,
  });

  const previewPanels = {
    leftPanel: (
      <SessionPagePreviewWidget
        session={currentSession}
        viewer={viewer}
        showCampaignInfo={showCampaignInfo}
        canNavigateToCampaignDirectly={canNavigateToCampaignDirectly}
        campaignNavigationTarget={campaignNavigationTarget}
        onJoin={handleJoin}
        onLeave={handleLeave}
        canJoin={canJoin}
        canApplyAsGm={canApplyAsGm}
        canLeave={canLeave}
      />
    ),
    rightPanel: tabPanels.rightPanel,
  };

  const panelState = isPreviewMode ? previewPanels : tabPanels;

  return (
    <SessionLayout
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
          <SessionNavigation
            activeTab={activeTab}
            availableTabs={availableTabs}
            onTabChange={setActiveTab}
            canManage={canManageSettings}
            canManageSession={canManageSession}
          />
        )
      }
      leftPanel={panelState.leftPanel}
      rightPanel={panelState.rightPanel}
    />
  );
}
