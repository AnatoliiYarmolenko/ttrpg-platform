const prismaModule = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');
const {
  CHAT_SCOPES,
  buildChatAccessContext,
} = require('../domain/chat/chat-access.context');
const {
  canReadChat,
  canWriteChat,
  getChatCapabilities,
} = require('../domain/chat/chat.policy');

const CHAT_MESSAGE_AUTHOR_SELECT = Object.freeze({
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
});

const DEFAULT_MESSAGES_LIMIT = 50;
const MAX_MESSAGES_LIMIT = 100;

function parsePositiveInt(value, label = 'ID') {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, `${label} повинен бути позитивним числом`);
  }

  return parsed;
}

function buildCursor(message) {
  if (!message) {
    return null;
  }

  return `${message.createdAt.toISOString()}:${message.id}`;
}

function parseCursor(cursor) {
  if (typeof cursor !== 'string' || !cursor.trim()) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'cursor повинен бути непорожнім рядком');
  }

  const separatorIndex = cursor.lastIndexOf(':');
  if (separatorIndex <= 0 || separatorIndex === cursor.length - 1) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невірний формат cursor');
  }

  const timestampPart = cursor.slice(0, separatorIndex);
  const idPart = cursor.slice(separatorIndex + 1);
  const createdAt = new Date(timestampPart);

  if (Number.isNaN(createdAt.getTime())) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Невірний формат cursor');
  }

  const id = parsePositiveInt(idPart, 'cursor id');

  return { createdAt, id };
}

function mapChatMessage(message) {
  if (!message) {
    return null;
  }

  return {
    id: message.id,
    chatId: message.chatId,
    type: message.type,
    content: message.content,
    authorId: message.authorId,
    author: message.author || null,
    createdAt: message.createdAt,
  };
}

class ChatService {
  get prisma() {
    return prismaModule.prisma;
  }

  _normalizeContent(content) {
    if (typeof content !== 'string') {
      return '';
    }

    return content.trim();
  }

  _buildDescriptor(chat, context, latestCursor) {
    const scope = context.scope;
    const isCampaignScope = scope === CHAT_SCOPES.CAMPAIGN;

    return {
      id: chat.id,
      scope,
      entityId: isCampaignScope ? chat.campaignId : chat.sessionId,
      title: isCampaignScope ? chat.campaign?.title || null : chat.session?.title || null,
      readonly: Boolean(context.readonly),
      latestCursor,
    };
  }

  _requireCanRead(context) {
    if (!canReadChat(context)) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED);
    }
  }

  _requireCanWrite(context) {
    if (!canReadChat(context)) {
      throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED);
    }

    if (!canWriteChat(context)) {
      throw new AppError(ERROR_CODES.CHAT_READONLY);
    }
  }

  async _getLatestCursor(chatId) {
    const latestMessage = await this.prisma.chatMessage.findFirst({
      where: { chatId },
      select: { id: true, createdAt: true },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });

    return buildCursor(latestMessage);
  }

  async _getChatByCampaignId(campaignId) {
    const campaignIdInt = parsePositiveInt(campaignId, 'ID кампанії');

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignIdInt },
      include: {
        members: {
          select: { userId: true },
        },
        chat: {
          select: { id: true, campaignId: true, sessionId: true },
        },
      },
    });

    if (!campaign) {
      throw new AppError(ERROR_CODES.CAMPAIGN_NOT_FOUND);
    }

    if (!campaign.chat) {
      throw new AppError(ERROR_CODES.CHAT_NOT_FOUND);
    }

    return {
      ...campaign.chat,
      campaign,
      session: null,
    };
  }

  async _getChatBySessionId(sessionId) {
    const sessionIdInt = parsePositiveInt(sessionId, 'ID сесії');

    const session = await this.prisma.session.findUnique({
      where: { id: sessionIdInt },
      include: {
        campaign: {
          select: { id: true, status: true, ownerId: true },
        },
        participants: {
          select: { userId: true, status: true, role: true },
        },
        chat: {
          select: { id: true, campaignId: true, sessionId: true },
        },
      },
    });

    if (!session) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Сесія не знайдена');
    }

    if (!session.chat) {
      throw new AppError(ERROR_CODES.CHAT_NOT_FOUND);
    }

    return {
      ...session.chat,
      session,
      campaign: null,
    };
  }

  async _getChatById(chatId) {
    const chatIdInt = parsePositiveInt(chatId, 'ID чату');

    const chat = await this.prisma.chat.findUnique({
      where: { id: chatIdInt },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            status: true,
            ownerId: true,
            members: {
              select: { userId: true },
            },
          },
        },
        session: {
          select: {
            id: true,
            title: true,
            status: true,
            campaignId: true,
            campaign: {
              select: { id: true, status: true, ownerId: true },
            },
            participants: {
              select: { userId: true, status: true, role: true },
            },
          },
        },
      },
    });

    if (!chat) {
      throw new AppError(ERROR_CODES.CHAT_NOT_FOUND);
    }

    return chat;
  }

  async getCampaignChatDescriptor(campaignId, userId) {
    const chat = await this._getChatByCampaignId(campaignId);
    const context = buildChatAccessContext({ chat, userId });
    const capabilities = getChatCapabilities(context);

    this._requireCanRead(context);

    const latestCursor = await this._getLatestCursor(chat.id);

    return {
      chat: this._buildDescriptor(chat, context, latestCursor),
      capabilities,
    };
  }

  async getSessionChatDescriptor(sessionId, userId) {
    const chat = await this._getChatBySessionId(sessionId);
    const context = buildChatAccessContext({ chat, userId });
    const capabilities = getChatCapabilities(context);

    this._requireCanRead(context);

    const latestCursor = await this._getLatestCursor(chat.id);

    return {
      chat: this._buildDescriptor(chat, context, latestCursor),
      capabilities,
    };
  }

  async getChatJoinState(chatId, userId) {
    const chat = await this._getChatById(chatId);
    const context = buildChatAccessContext({ chat, userId });
    const capabilities = getChatCapabilities(context);

    this._requireCanRead(context);

    const snapshotCursor = await this._getLatestCursor(chat.id);

    return {
      chatId: chat.id,
      readonly: Boolean(context.readonly),
      capabilities,
      snapshotCursor,
    };
  }

  async getRecentMessages(chatId, userId, options = {}) {
    const chat = await this._getChatById(chatId);
    const context = buildChatAccessContext({ chat, userId });

    this._requireCanRead(context);

    const requestedLimit = Number.isInteger(options.limit) ? options.limit : DEFAULT_MESSAGES_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_MESSAGES_LIMIT);

    const rawMessages = await this.prisma.chatMessage.findMany({
      where: { chatId: chat.id },
      include: {
        author: {
          select: CHAT_MESSAGE_AUTHOR_SELECT,
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    });

    const total = await this.prisma.chatMessage.count({
      where: { chatId: chat.id },
    });

    return {
      messages: rawMessages.reverse().map(mapChatMessage),
      limit,
      total,
    };
  }

  async getMessagesAfter(chatId, userId, options = {}) {
    const chat = await this._getChatById(chatId);
    const context = buildChatAccessContext({ chat, userId });

    this._requireCanRead(context);

    const { createdAt, id } = parseCursor(options.after);
    const requestedLimit = Number.isInteger(options.limit) ? options.limit : DEFAULT_MESSAGES_LIMIT;
    const limit = Math.min(Math.max(requestedLimit, 1), MAX_MESSAGES_LIMIT);

    const rawMessages = await this.prisma.chatMessage.findMany({
      where: {
        chatId: chat.id,
        OR: [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: id } },
        ],
      },
      include: {
        author: {
          select: CHAT_MESSAGE_AUTHOR_SELECT,
        },
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      take: limit,
    });

    const total = await this.prisma.chatMessage.count({
      where: {
        chatId: chat.id,
        OR: [
          { createdAt: { gt: createdAt } },
          { createdAt, id: { gt: id } },
        ],
      },
    });

    return {
      messages: rawMessages.map(mapChatMessage),
      limit,
      total,
    };
  }

  async createUserMessage(chatId, userId, content) {
    const chat = await this._getChatById(chatId);
    const context = buildChatAccessContext({ chat, userId });

    this._requireCanWrite(context);

    const normalizedContent = this._normalizeContent(content);
    if (!normalizedContent) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Повідомлення не може бути порожнім');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        chatId: chat.id,
        type: 'USER',
        content: normalizedContent,
        authorId: userId || null,
      },
      include: {
        author: {
          select: CHAT_MESSAGE_AUTHOR_SELECT,
        },
      },
    });

    return mapChatMessage(message);
  }
}

const chatService = new ChatService();

// Export utilities as instance properties for unit tests
chatService.parsePositiveInt = parsePositiveInt;
chatService.buildCursor = buildCursor;
chatService.parseCursor = parseCursor;
chatService.mapChatMessage = mapChatMessage;

module.exports = chatService;
