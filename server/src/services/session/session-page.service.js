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

  const isPastDate = (value) => {
    if (!value) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    return date.getTime() < Date.now();
  };

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

    const hasConfirmedGm = session.participants?.some(
      (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
    );

    if (hasConfirmedGm) {
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

    const hasConfirmedGm = Boolean(
      session.participants?.some(
        (participant) => participant.role === 'GM' && participant.status === 'CONFIRMED'
      )
    );

    if (hasConfirmedGm) {
      return false;
    }

    return Boolean(
      myParticipant?.role === 'PLAYER'
      && myParticipant?.status === 'CONFIRMED'
    );
  };

  const shouldShowCampaignSection = ({ session, viewer }) => {
    if (!session?.campaign) {
      return false;
    }

    const isGuestViewForPublicCampaignSession = session.visibility === 'PUBLIC'
      && session.campaign?.visibility === 'LINK_ONLY'
      && viewer.isCampaignMember === false;

    return !isGuestViewForPublicCampaignSession;
  };

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
    const isOwner = Boolean(viewer.isSessionOwner || (userId && session.ownerId === userId));
    const isParticipant = Boolean(viewer.isParticipant || myParticipant);
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
      && !isPastDate(session.date)
      && !isCampaignFinished
      && !['FINISHED', 'CANCELED'].includes(session.status);
    const canManageParticipants = Boolean(viewer.canManageParticipants || isConfirmedGm);
    const canManageGmRequests = isOwner;
    const canManageShareLink = canManageShareLinkForViewer({
      session,
      isOwner,
      myParticipant,
      isCampaignFinished,
    });
    const canOpenCampaign = Boolean(session.campaign && session.campaign.visibility !== 'LINK_ONLY');
    const canManageSession = Boolean(canStart || canFinish || canCancel || canDelete || canManageShareLink);
    const canReadParticipants = Boolean(isOwner || isParticipant || isCampaignMember);
    const playerCount = participants.filter((participant) => participant.role === 'PLAYER').length;
    const campaignSectionVisible = shouldShowCampaignSection({ session, viewer });

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
        campaign: mapCampaign(session.campaign),
      },
      viewer: {
        role: viewer.role || (isOwner ? 'OWNER' : null),
        isSessionOwner: isOwner,
        isParticipant,
        isCampaignMember,
        isCampaignOwner: Boolean(viewer.isCampaignOwner),
        participationStatus: viewer.participationStatus || myParticipant?.status || null,
      },
      actions: {
        canJoin: canJoinSession({ session, userId, hasSessionMembership, canUseJoin }),
        canApplyAsGm: canApplyAsGm({ session, userId, hasSessionMembership, canUseJoin }),
        canLeave: Boolean(isParticipant && !isOwner),
        canStart,
        canFinish,
        canCancel,
        canDelete,
        canEditSettings,
        canManageParticipants,
        canManageGmRequests,
        canManageShareLink,
        canOpenCampaign,
      },
      sections: {
        participants: {
          visible: canReadParticipants,
          count: playerCount,
          maxPlayers: session.maxPlayers || null,
          items: canReadParticipants ? participants : [],
        },
        campaign: {
          visible: campaignSectionVisible,
          linkable: campaignSectionVisible && canOpenCampaign,
          data: campaignSectionVisible ? mapCampaign(session.campaign) : null,
        },
      },
      ui: {
        previewMode: !hasSessionMembership,
        availableTabs: buildAvailableTabs({ canEditSettings, canManageSession }),
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