import React from 'react';
import { Navigate } from 'react-router-dom';

// Controller hook — вся логіка сторінки інкапсульована тут
import useSessionPageController from '../hooks/useSessionPageController';

// Layout & Navigation
import SessionLayout from '../components/layout/SessionLayout';
import SessionNavigation, { TABS } from '../components/navigation/SessionNavigation';

// Widgets
import SessionInfoWidget from '../components/widgets/SessionInfoWidget';
import SessionSettingsWidget from '../components/widgets/SessionSettingsWidget';
import SessionPagePreviewWidget from '../components/widgets/SessionPreviewWidget';
import SessionPageParticipantsWidget from '../components/widgets/SessionParticipantsWidget';

// Shared
import { UserProfilePreview } from '@/components/shared';
import FullPageLoader from '@/components/shared/FullPageLoader';
import ErrorScreen from '@/components/shared/ErrorScreen';

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
    setActiveTab,
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
    handleParticipantStatusChange,
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
  const renderLeftPanel = () => {
    if (viewingUserId) {
      return (
        <UserProfilePreview
          userId={viewingUserId}
          onBack={handleBackFromProfile}
          participants={currentSession.participants}
        />
      );
    }

    if (isPreviewMode) {
      return (
        <SessionPagePreviewWidget
          session={currentSession}
          onJoin={handleJoin}
          canJoin={canJoin}
          canApplyAsGm={canApplyAsGm}
          showCampaignInfo={showCampaignInfo}
          canNavigateToCampaignDirectly={canNavigateToCampaignDirectly}
          isLoading={isLoading}
        />
      );
    }

    switch (activeTab) {
      case TABS.SETTINGS:
        if (canManageSettings) {
          return (
            <SessionSettingsWidget
              session={currentSession}
              onSave={handleSaveSettings}
              onDelete={handleDelete}
              canDelete={canDeleteSession}
              isLoading={isLoading}
            />
          );
        }
        return (
          <SessionInfoWidget
            session={currentSession}
            myRole={myRole}
            canManage={canManageStatus}
            canStartSession={canStartSession}
            canFinishSession={canFinishSession}
            canCancelSession={canCancelSession}
            canManageShareLink={canManageShareLink}
            currentShareLink={currentShareLink}
            onLeave={handleLeave}
            onStatusChange={handleStatusChange}
            onMarkAsFinished={handleMarkAsFinished}
            onRegenerateShareLink={handleRegenerateShareLink}
            onCopyShareLink={handleCopyShareLink}
            showCampaignInfo={showCampaignInfo}
            canNavigateToCampaignDirectly={canNavigateToCampaignDirectly}
            isLoading={isLoading}
          />
        );

      case TABS.DETAILS:
      default:
        return (
          <SessionInfoWidget
            session={currentSession}
            myRole={myRole}
            canManage={canManageStatus}
            canStartSession={canStartSession}
            canFinishSession={canFinishSession}
            canCancelSession={canCancelSession}
            canManageShareLink={canManageShareLink}
            currentShareLink={currentShareLink}
            onLeave={handleLeave}
            onStatusChange={handleStatusChange}
            onMarkAsFinished={handleMarkAsFinished}
            onRegenerateShareLink={handleRegenerateShareLink}
            onCopyShareLink={handleCopyShareLink}
            showCampaignInfo={showCampaignInfo}
            canNavigateToCampaignDirectly={canNavigateToCampaignDirectly}
            isLoading={isLoading}
          />
        );
    }
  };

  // === Right panel ===
  const renderRightPanel = () => (
    <SessionPageParticipantsWidget
      sessionId={id}
      session={currentSession}
      initialParticipants={currentSession.participants || []}
      canReadParticipants={canReadParticipants}
      canManage={canManageParticipants}
      canManageGmRequests={canManageGmRequests}
      onParticipantStatusChange={handleParticipantStatusChange}
      currentUserId={user?.id}
      onViewProfile={handleViewProfile}
      maxPlayers={currentSession.maxPlayers}
    />
  );

  return (
    <SessionLayout
      topBar={
        !isPreviewMode ? (
          <SessionNavigation
            sessionTitle={currentSession.title}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            canManage={canManageSettings}
            campaignTitle={currentSession.campaign?.title}
          />
        ) : (
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
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-xl border-2 border-white/50 bg-brand-dark text-white hover:bg-brand-accent hover:text-brand-dark hover:border-brand-dark transition-all font-bold shadow-lg"
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
