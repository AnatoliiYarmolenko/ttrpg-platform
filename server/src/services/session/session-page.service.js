const { canOpenCampaign: canOpenCampaignByAccess } = require('../../domain/access/access-rules');

function createSessionPageService({ sessionQueryService }) {
  const mapOwner = (owner) => {
    if (!owner) return null;

    return {
      id: owner.id,
      username: owner.username,
      displayName: owner.displayName,
      avatarUrl: owner.avatarUrl,
    };
  };

  const mapCampaign = (campaign) => {
    if (!campaign) return null;

    return {
      id: campaign.id,
      title: campaign.title,
      visibility: campaign.visibility,
      status: campaign.status,
      system: campaign.system || null,
      ownerId: campaign.ownerId,
    };
  };

  const mapParticipant = (participant) => ({
    id: participant.id,
    userId: participant.userId,
    role: participant.role,
    status: participant.status,
    isGuest: Boolean(participant.isGuest),
    user: participant.user
      ? {
        id: participant.user.id,
        username: participant.user.username,
        displayName: participant.user.displayName,
        avatarUrl: participant.user.avatarUrl,
      }
      : null,
  });

  const hasConfirmedGm = (participants = []) => participants.some(
    (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
  );

  const canUseJoinFlow = ({ session, userId, viewer, hasSessionMembership, isCampaignMember }) => {
    if (!session || !userId || hasSessionMembership) {
      return false;
    }

    if (viewer.joinMode === 'MEMBERS_ONLY') {
      return isCampaignMember;
    }

    return viewer.joinMode === 'OPEN' || viewer.joinMode === 'REQUEST';
  };

  const canJoinSession = ({ session, userId, hasSessionMembership, canUseJoin }) => {
    if (!session || !userId || hasSessionMembership) return false;
    if (session.status !== 'PLANNED') return false;
    if (session.campaign?.status === 'FINISHED') return false;

    if (session.maxPlayers) {
      const currentPlayers =
        session.participants?.filter((participant) => participant.role === 'PLAYER').length || 0;

      if (currentPlayers >= session.maxPlayers) {
        return false;
      }
    }

    return canUseJoin;
  };

  const canApplyAsGm = ({ session, userId, hasSessionMembership, canUseJoin }) => {
    if (!session || !userId || hasSessionMembership) return false;
    if (session.status !== 'PLANNED') return false;
    if (session.campaign?.status === 'FINISHED') return false;

    const sessionDate = new Date(session.date);
    if (!Number.isNaN(sessionDate.getTime()) && sessionDate.getTime() < Date.now()) {
      return false;
    }

    if (hasConfirmedGm(session.participants || [])) {
      return false;
    }

    return canUseJoin;
  };

  const canManageShareLinkForViewer = ({ session, isOwner, myParticipant, isCampaignFinished }) => {
    if (session.visibility !== 'LINK_ONLY' || isCampaignFinished) {
      return false;
    }

    if (['FINISHED', 'CANCELED'].includes(session.status)) {
      return false;
    }

    if (isOwner) {
      return true;
    }

    if (session.campaignId) {
      return false;
    }

    if (hasConfirmedGm(session.participants || [])) {
      return false;
    }

    return Boolean(
      myParticipant?.role === 'PLAYER'
      && myParticipant?.status === 'CONFIRMED'
    );
  };

  const resolveSessionPageAccess = ({ session, viewer, userId, participants, myParticipant }) => {
    const isOwner = Boolean(viewer.isSessionOwner || (userId && session.ownerId === userId));
    const isParticipant = Boolean(viewer.isParticipant);
    const isPendingParticipant = Boolean(viewer.isPendingParticipant);
    const isCampaignMember = Boolean(viewer.isCampaignMember);
    const hasSessionMembership = Boolean(isOwner || isParticipant);
    const isCampaignFinished = session?.campaign?.status === 'FINISHED';
    const isConfirmedGm = Boolean(
      myParticipant?.role === 'GM'
      && myParticipant?.status === 'CONFIRMED'
    );
    const isCampaignOwnerOverride = Boolean(
      session.campaignId
      && viewer.isCampaignOwner
      && !isOwner
    );
    const isNonGuestCampaignParticipant = Boolean(
      session?.campaignId
      && myParticipant?.isGuest === false
    );
    const hasCampaignAccessEntitlement = Boolean(
      isCampaignMember
      || viewer.isCampaignOwner
      || isNonGuestCampaignParticipant
    );
    const canUseJoin = canUseJoinFlow({
      session,
      userId,
      viewer,
      hasSessionMembership,
      isCampaignMember,
    });
    const canStart = Boolean(isConfirmedGm && session.status === 'PLANNED');
    const canFinish = Boolean(isConfirmedGm && ['PLANNED', 'ACTIVE'].includes(session.status));
    const canCancel = Boolean(
      ['PLANNED', 'ACTIVE'].includes(session.status)
      && (
        isOwner
        || isCampaignOwnerOverride
        || (session.status === 'ACTIVE' && isConfirmedGm)
      )
    );
    const canDelete = Boolean((isOwner || isCampaignOwnerOverride) && session.status === 'PLANNED');
    const canEditSettings = Boolean(viewer.canManage)
      && !isCampaignFinished
      && session.status === 'PLANNED';
    const canManageParticipants = Boolean(viewer.canManageParticipants || isConfirmedGm);
    const canManageGmRequests = isOwner;
    const canManageShareLink = canManageShareLinkForViewer({
      session,
      isOwner,
      myParticipant,
      isCampaignFinished,
    });
    const canOpenCampaign = Boolean(
      session.campaign
      && canOpenCampaignByAccess({
        visibility: session.campaign.visibility,
        isOwner: Boolean(viewer.isCampaignOwner),
        isCampaignMember: Boolean(isCampaignMember || viewer.isCampaignOwner || isNonGuestCampaignParticipant),
        userId,
        hasValidShareToken: Boolean(viewer.hasValidCampaignShareToken),
      })
    );

    return {
      isOwner,
      isParticipant,
      isPendingParticipant,
      isCampaignMember,
      hasSessionMembership,
      isCampaignFinished,
      isConfirmedGm,
      isCampaignOwnerOverride,
      isNonGuestCampaignParticipant,
      hasCampaignAccessEntitlement,
      canUseJoin,
      canStart,
      canFinish,
      canCancel,
      canDelete,
      canEditSettings,
      canManageParticipants,
      canManageGmRequests,
      canManageShareLink,
      canOpenCampaign,
    };
  };

  const buildSessionPageActions = ({ session, viewerState }) => ({
    canJoin: canJoinSession({
      session,
      userId: viewerState.userId,
      hasSessionMembership: viewerState.hasSessionMembership,
      canUseJoin: viewerState.canUseJoin,
    }),
    canApplyAsGm: canApplyAsGm({
      session,
      userId: viewerState.userId,
      hasSessionMembership: viewerState.hasSessionMembership,
      canUseJoin: viewerState.canUseJoin,
    }),
    canLeave: Boolean(viewerState.isParticipant && !viewerState.isOwner),
    canStart: viewerState.canStart,
    canFinish: viewerState.canFinish,
    canCancel: viewerState.canCancel,
    canDelete: viewerState.canDelete,
    canEditSettings: viewerState.canEditSettings,
    canManageParticipants: viewerState.canManageParticipants,
    canManageGmRequests: viewerState.canManageGmRequests,
    canManageShareLink: viewerState.canManageShareLink,
    canOpenCampaign: viewerState.canOpenCampaign,
  });

  const buildSessionPageSections = ({ session, viewerState, participants, campaignSectionVisible, campaignData }) => ({
    participants: {
      visible: viewerState.isOwner || viewerState.isParticipant || viewerState.isCampaignMember,
      count: participants.filter((participant) => participant.role === 'PLAYER').length,
      hasConfirmedGm: hasConfirmedGm(participants),
      maxPlayers: session.maxPlayers || null,
      items: viewerState.isOwner || viewerState.isParticipant || viewerState.isCampaignMember
        ? participants
        : [],
    },
    campaign: {
      visible: campaignSectionVisible,
      linkable: campaignSectionVisible && viewerState.canOpenCampaign,
      data: campaignSectionVisible ? campaignData : null,
    },
  });

  const buildAvailableTabs = ({ canEditSettings, canManageSession }) => {
    const tabs = ['details', 'communication'];

    if (canEditSettings) {
      tabs.push('settings');
    }

    if (canManageSession && !canEditSettings) {
      tabs.push('settings');
    }

    return tabs;
  };

  const buildSessionPageDto = ({ session, userId }) => {
    const viewer = session.viewer || {};
    const participants = Array.isArray(session.participants)
      ? session.participants.map(mapParticipant)
      : [];

    const myParticipant = userId
      ? participants.find((participant) => participant.userId === userId) || null
      : null;
    const viewerState = resolveSessionPageAccess({ session, viewer, userId, participants, myParticipant });
    const canManageSession = Boolean(
      viewerState.canStart
      || viewerState.canFinish
      || viewerState.canCancel
      || viewerState.canDelete
      || viewerState.canManageShareLink
    );
    const campaignData = mapCampaign(session.campaign);
    const campaignSectionVisible = Boolean(campaignData);
    const actions = buildSessionPageActions({ session, viewerState: { ...viewerState, userId } });
    const sections = buildSessionPageSections({
      session,
      viewerState,
      participants,
      campaignSectionVisible,
      campaignData,
    });

    return {
      entity: {
        id: session.id,
        title: session.title,
        description: session.description,
        date: session.date,
        duration: session.duration,
        status: session.status,
        visibility: session.visibility,
        system: session.system,
        price: session.price,
        maxPlayers: session.maxPlayers,
        ownerId: session.ownerId,
        owner: mapOwner(session.owner),
        campaignId: session.campaignId,
        campaign: campaignData,
      },
      viewer: {
        role: viewer.role || (viewerState.isOwner ? 'OWNER' : null),
        isSessionOwner: viewerState.isOwner,
        isParticipant: viewerState.isParticipant,
        isPendingParticipant: viewerState.isPendingParticipant,
        isCampaignMember: viewerState.isCampaignMember,
        isCampaignOwner: Boolean(viewer.isCampaignOwner),
        participationStatus: viewer.participationStatus || myParticipant?.status || null,
        pendingJoinRequestStatus: viewer.participationStatus === 'PENDING' ? 'PENDING' : null,
      },
      actions,
      sections,
      ui: {
        previewMode: !viewerState.hasSessionMembership,
        availableTabs: buildAvailableTabs({ canEditSettings: viewerState.canEditSettings, canManageSession }),
      },
    };
  };

  const getSessionPageById = async (sessionId, userId = null, options = {}) => {
    const session = await sessionQueryService.getSessionById(sessionId, userId, options);
    return buildSessionPageDto({ session, userId });
  };

  const getSessionPageByShareToken = async (rawToken, userId = null) => {
    const session = await sessionQueryService.getSessionByShareToken(rawToken, userId);
    return buildSessionPageDto({ session, userId });
  };

  return {
    buildSessionPageDto,
    getSessionPageById,
    getSessionPageByShareToken,
  };
}

module.exports = createSessionPageService;
