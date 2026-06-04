import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import useSessionPageController from '../hooks/useSessionPageController';
import { useCallViewerSync } from '@/features/call/hooks/useCallViewerSync';

import SessionLayout from '../components/layout/SessionLayout';
import SessionNavigation from '../components/navigation/SessionNavigation';
import SessionTabRenderer from '../components/layout/SessionTabRenderer';

import SessionPagePreviewWidget from '../components/widgets/SessionPreviewWidget';

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
  const location = useLocation();
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
    isUpdatingSettings,
    isRegeneratingShareLink,
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

  useCallViewerSync(isPreviewMode ? null : id);

  const chatController = useChatController('session', Number.parseInt(id, 10), {
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

  if (!currentSession) {
    return <FullPageLoader text="Завантаження сесії..." />;
  }

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
    isLoading: isLoading || isUpdatingSettings,
    isRegeneratingShareLink,
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
