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
import { UserProfilePreview } from '@/components/shared';
import FullPageLoader from '@/components/shared/FullPageLoader';
import ErrorScreen from '@/components/shared/ErrorScreen';
import Button from '@/components/ui/Button';

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
    showCampaignInfo,
    canNavigateToCampaignDirectly,
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
    onStatusChange: handleStatusChange,
    onMarkAsFinished: handleMarkAsFinished,
    showCampaignInfo,
    isLoading,
  };

  const sessionSettingsProps = {
    session: currentSession,
    onSave: handleSaveSettings,
    onDelete: handleDelete,
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
    sessionTitle: currentSession.title,
  });

  const previewPanels = {
    leftPanel: (
      <SessionPagePreviewWidget
        session={currentSession}
        onJoin={handleJoin}
        canJoin={canJoin}
        canApplyAsGm={canApplyAsGm}
        showCampaignInfo={showCampaignInfo}
        canNavigateToCampaignDirectly={canNavigateToCampaignDirectly}
        isLoading={isLoading}
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
              <div className="bg-white px-4 py-2 rounded-xl border-2 border-brand-light/30 shadow-md flex items-center gap-2">
                <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-brand-accent font-bold text-xs">
                  D20
                </div>
                <span className="font-bold text-brand-dark hidden md:block">
                  TTRPG Platform
                </span>
              </div>
              {currentSession.campaign && showCampaignInfo && (
                <>
                  <span className="text-white/40 hidden sm:inline">/</span>
                  {canNavigateToCampaignDirectly ? (
                    <button
                      onClick={() =>
                        navigate(`/campaign/${currentSession.campaign.id}`)
                      }
                      className="text-white/70 hover:text-brand-accent transition-colors text-sm truncate max-w-[150px]"
                    >
                      {currentSession.campaign.title}
                    </button>
                  ) : (
                    <span className="text-white/70 text-sm truncate max-w-[150px]">
                      {currentSession.campaign.title}
                    </span>
                  )}
                </>
              )}
              <span className="text-white/40 hidden sm:inline">/</span>
              <span className="text-white font-bold text-sm truncate">
                {currentSession.title}
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
          <SessionNavigation
            sessionTitle={currentSession.title}
            activeTab={activeTab}
            availableTabs={availableTabs}
            onTabChange={setActiveTab}
            canManage={canManageSettings}
            canManageSession={canManageSession}
            campaignTitle={currentSession.campaign?.title}
          />
        )
      }
      leftPanel={panelState.leftPanel}
      rightPanel={panelState.rightPanel}
    />
  );
}
