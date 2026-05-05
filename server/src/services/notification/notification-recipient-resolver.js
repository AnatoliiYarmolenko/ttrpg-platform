const { prisma } = require('../../lib/prisma');

/**
 * Resolves audience rules to specific user IDs
 * Supports: target_user, session_owner, session_managers, session_confirmed_participants,
 *           session_pending_participants, campaign_owner, campaign_managers, campaign_members
 */
class NotificationRecipientResolver {
  /**
   * Resolve audience to user IDs
   * @param {string} audience - Audience type
   * @param {Object} context - Context data (sessionId, campaignId, userId, etc.)
   * @returns {Promise<number[]>} Array of user IDs
   */
  async resolve(audience, context = {}) {
    switch (audience) {
      case 'target_user':
        return this._resolveTargetUser(context);
      case 'session_owner':
        return this._resolveSessionOwner(context);
      case 'session_managers':
        return this._resolveSessionManagers(context);
      case 'session_confirmed_participants':
        return this._resolveSessionParticipants(context, 'CONFIRMED');
      case 'session_pending_participants':
        return this._resolveSessionParticipants(context, 'PENDING');
      case 'campaign_owner':
        return this._resolveCampaignOwner(context);
      case 'campaign_managers':
        return this._resolveCampaignManagers(context);
      case 'campaign_members':
        return this._resolveCampaignMembers(context);
      default:
        return [];
    }
  }

  async _resolveTargetUser(context) {
    const { userId } = context;
    if (!userId) return [];
    return [userId];
  }

  async _resolveSessionOwner(context) {
    const { sessionId } = context;
    if (!sessionId) return [];

    const session = await prisma.session.findUnique({
      where: { id: Number.parseInt(sessionId) },
      select: { ownerId: true },
    });

    return session ? [session.ownerId] : [];
  }

  async _resolveSessionManagers(context) {
    const { sessionId } = context;
    if (!sessionId) return [];

    const session = await prisma.session.findUnique({
      where: { id: Number.parseInt(sessionId) },
      include: {
        campaign: {
          select: { ownerId: true },
        },
        participants: {
          where: {
            role: 'GM',
            status: 'CONFIRMED',
          },
          select: { userId: true },
        },
      },
    });

    if (!session) return [];

    const managerIds = new Set();

    // Session owner
    managerIds.add(session.ownerId);

    // Confirmed GMs
    session.participants.forEach((p) => managerIds.add(p.userId));

    // Campaign owner override for campaign sessions
    if (session.campaign?.ownerId) {
      managerIds.add(session.campaign.ownerId);
    }

    return [...managerIds];
  }

  async _resolveSessionParticipants(context, status) {
    const { sessionId } = context;
    if (!sessionId) return [];

    const participants = await prisma.sessionParticipant.findMany({
      where: {
        sessionId: Number.parseInt(sessionId),
        status,
      },
      select: { userId: true },
    });

    return participants.map((p) => p.userId);
  }

  async _resolveCampaignOwner(context) {
    const { campaignId } = context;
    if (!campaignId) return [];

    const campaign = await prisma.campaign.findUnique({
      where: { id: Number.parseInt(campaignId) },
      select: { ownerId: true },
    });

    return campaign ? [campaign.ownerId] : [];
  }

  async _resolveCampaignManagers(context) {
    const { campaignId } = context;
    if (!campaignId) return [];

    const members = await prisma.campaignMember.findMany({
      where: {
        campaignId: Number.parseInt(campaignId),
        role: { in: ['OWNER', 'GM'] },
      },
      select: { userId: true },
    });

    return members.map((m) => m.userId);
  }

  async _resolveCampaignMembers(context) {
    const { campaignId } = context;
    if (!campaignId) return [];

    const members = await prisma.campaignMember.findMany({
      where: {
        campaignId: Number.parseInt(campaignId),
      },
      select: { userId: true },
    });

    return members.map((m) => m.userId);
  }
}

module.exports = new NotificationRecipientResolver();
