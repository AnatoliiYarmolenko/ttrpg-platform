const { prisma } = require('../lib/prisma');
const { Prisma } = require('@prisma/client');
const { createError, AppError, ERROR_CODES } = require('../constants/errors');
const notificationService = require('./notification.service');
const { logger } = require('../lib/logger');

class WalletService {
  /**
   * Отримати або автоматично створити гаманець для користувача
   * @param {number} userId - ID користувача
   * @returns {Promise<Object>} Гаманець
   */
  async getWallet(userId) {
    const targetUserId = Number.parseInt(userId, 10);
    let wallet = await prisma.wallet.findUnique({
      where: { userId: targetUserId },
    });
    if (!wallet) {
      try {
        wallet = await prisma.wallet.create({
          data: {
            userId: targetUserId,
            balance: 0,
          },
        });
      } catch (err) {
        if (err.code === 'P2002') {
          wallet = await prisma.wallet.findUnique({
            where: { userId: targetUserId },
          });
        } else {
          throw err;
        }
      }
    }
    return wallet;
  }

  /**
   * Приватний допоміжний метод для отримання гаманця з блокуванням рядка (FOR UPDATE)
   * та автоматичним створенням, якщо він не існує (наприклад, для старих користувачів)
   * @private
   */
  async _getOrCreateLockedWallet(userId, client) {
    const targetUserId = Number.parseInt(userId, 10);
    let [wallet] = await client.$queryRaw`SELECT * FROM "Wallet" WHERE "userId" = ${targetUserId} FOR UPDATE`;
    if (!wallet) {
      try {
        wallet = await client.wallet.create({
          data: {
            userId: targetUserId,
            balance: 0,
          },
        });
      } catch (err) {
        if (err.code === 'P2002') {
          [wallet] = await client.$queryRaw`SELECT * FROM "Wallet" WHERE "userId" = ${targetUserId} FOR UPDATE`;
        } else {
          throw err;
        }
      }
    }
    return wallet;
  }

  /**
   * Поповнення балансу гаманця
   * @param {number} userId - ID користувача
   * @param {number|string|Decimal} amount - Сума поповнення
   * @returns {Promise<Object>} Оновлений гаманець
   */
  async topUp(userId, amount) {
    const targetUserId = Number.parseInt(userId, 10);
    const decAmount = new Prisma.Decimal(amount);
    
    if (decAmount.lte(0)) {
      throw createError.invalidAmount();
    }

    let transactionRecord;
    const updatedWallet = await prisma.$transaction(async (tx) => {
      const wallet = await this._getOrCreateLockedWallet(targetUserId, tx);

      const balance = new Prisma.Decimal(wallet.balance);
      const newBalance = balance.plus(decAmount);

      const walletUpdate = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      transactionRecord = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: decAmount,
          type: 'TOP_UP',
        },
      });

      return walletUpdate;
    });

    notificationService.createNotification({
      eventKey: `wallet_top_up:${targetUserId}:${transactionRecord.id}`,
      type: 'WALLET_TOPPED_UP',
      severity: 'SUCCESS',
      category: 'payment',
      title: 'Баланс поповнено',
      body: `Ваш гаманець успішно поповнено на ${decAmount.toString()} Demo Coins.`,
      link: '/profile',
      recipientIds: [targetUserId],
      metadata: {
        userId: targetUserId,
        transactionId: transactionRecord.id,
        amount: decAmount.toString(),
      },
    }).catch((err) => {
      logger.error({ err, userId: targetUserId, amount: decAmount.toString() }, 'Помилка відправки сповіщення WALLET_TOPPED_UP');
    });

    return updatedWallet;
  }

  /**
   * Списання коштів гравця на користь сесії (Escrow-резервування)
   * @param {number} userId - ID користувача
   * @param {number} sessionId - ID сесії
   * @param {number|string|Decimal} amount - Сума списання
   * @param {Object} [tx] - Об'єкт транзакції Prisma
   * @returns {Promise<Object>} Оновлений гаманець
   */
  async reserveFunds(userId, sessionId, amount, tx) {
    const targetUserId = Number.parseInt(userId, 10);
    const targetSessionId = Number.parseInt(sessionId, 10);
    const decAmount = new Prisma.Decimal(amount);
    const client = tx || prisma;

    if (decAmount.lt(0)) {
      throw createError.invalidAmount();
    }

    if (decAmount.isZero()) {
      return this.getWallet(userId);
    }

    const wallet = await this._getOrCreateLockedWallet(targetUserId, client);

    const balance = new Prisma.Decimal(wallet.balance);
    if (balance.lt(decAmount)) {
      throw createError.insufficientFunds();
    }

    const newBalance = balance.minus(decAmount);

    const updatedWallet = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    await client.transaction.create({
      data: {
        walletId: wallet.id,
        amount: decAmount,
        type: 'RESERVE',
        sessionId: targetSessionId,
      },
    });

    notificationService.createNotification({
      eventKey: `payment_reserved:${targetUserId}:${targetSessionId}`,
      type: 'PAYMENT_RESERVED',
      severity: 'SUCCESS',
      category: 'payment',
      title: 'Кошти зарезервовано',
      body: `Зарезервовано ${decAmount.toString()} Demo Coins для участі у сесії.`,
      link: `/session/${targetSessionId}`,
      recipientIds: [targetUserId],
      metadata: {
        userId: targetUserId,
        sessionId: targetSessionId,
        amount: decAmount.toString(),
      },
    }).catch((err) => {
      logger.error({ err, userId: targetUserId, sessionId: targetSessionId }, 'Помилка відправки сповіщення PAYMENT_RESERVED');
    });

    return updatedWallet;
  }

  /**
   * Повернення коштів гравцю при скасуванні гри, виході чи відхиленні заявки
   * @param {number} userId - ID користувача
   * @param {number} sessionId - ID сесії
   * @param {number|string|Decimal} amount - Сума повернення
   * @param {Object} [tx] - Об'єкт транзакції Prisma
   * @returns {Promise<Object>} Оновлений гаманець
   */
  async refundFunds(userId, sessionId, amount, tx) {
    const targetUserId = Number.parseInt(userId, 10);
    const targetSessionId = Number.parseInt(sessionId, 10);
    const decAmount = new Prisma.Decimal(amount);
    const client = tx || prisma;

    if (decAmount.lt(0)) {
      throw createError.invalidAmount();
    }

    if (decAmount.isZero()) {
      return this.getWallet(userId);
    }

    const wallet = await this._getOrCreateLockedWallet(targetUserId, client);

    const balance = new Prisma.Decimal(wallet.balance);
    const newBalance = balance.plus(decAmount);

    const updatedWallet = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    await client.transaction.create({
      data: {
        walletId: wallet.id,
        amount: decAmount,
        type: 'REFUND',
        sessionId: targetSessionId,
      },
    });

    notificationService.createNotification({
      eventKey: `payment_refunded:${targetUserId}:${targetSessionId}`,
      type: 'PAYMENT_REFUNDED',
      severity: 'SUCCESS',
      category: 'payment',
      title: 'Повернення коштів',
      body: `Повернуто ${decAmount.toString()} Demo Coins на ваш гаманець.`,
      link: `/session/${targetSessionId}`,
      recipientIds: [targetUserId],
      metadata: {
        userId: targetUserId,
        sessionId: targetSessionId,
        amount: decAmount.toString(),
      },
    }).catch((err) => {
      logger.error({ err, userId: targetUserId, sessionId: targetSessionId }, 'Помилка відправки сповіщення PAYMENT_REFUNDED');
    });

    return updatedWallet;
  }

  /**
   * Виплата Майстру (GM) після завершення гри
   * @param {number} gmId - ID Майстра
   * @param {number} sessionId - ID сесії
   * @param {number|string|Decimal} amount - Сума виплати
   * @param {Object} [tx] - Об'єкт транзакції Prisma
   * @returns {Promise<Object>} Оновлений гаманець
   */
  async payoutFunds(gmId, sessionId, amount, tx) {
    const targetGmId = Number.parseInt(gmId, 10);
    const targetSessionId = Number.parseInt(sessionId, 10);
    const decAmount = new Prisma.Decimal(amount);
    const client = tx || prisma;

    if (decAmount.lt(0)) {
      throw createError.invalidAmount();
    }

    if (decAmount.isZero()) {
      return this.getWallet(gmId);
    }

    const wallet = await this._getOrCreateLockedWallet(targetGmId, client);

    const balance = new Prisma.Decimal(wallet.balance);
    const newBalance = balance.plus(decAmount);

    const updatedWallet = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    await client.transaction.create({
      data: {
        walletId: wallet.id,
        amount: decAmount,
        type: 'PAYOUT',
        sessionId: targetSessionId,
      },
    });

    notificationService.createNotification({
      eventKey: `payout_received:${targetGmId}:${targetSessionId}`,
      type: 'PAYOUT_RECEIVED',
      severity: 'SUCCESS',
      category: 'payment',
      title: 'Отримано виплату',
      body: `Вам нараховано виплату ${decAmount.toString()} Demo Coins за проведення сесії.`,
      link: `/session/${targetSessionId}`,
      recipientIds: [targetGmId],
      metadata: {
        gmId: targetGmId,
        sessionId: targetSessionId,
        amount: decAmount.toString(),
      },
    }).catch((err) => {
      logger.error({ err, gmId: targetGmId, sessionId: targetSessionId }, 'Помилка відправки сповіщення PAYOUT_RECEIVED');
    });

    return updatedWallet;
  }

  /**
   * Списання залишку балансу при видаленні акаунта
   * @param {number} userId - ID користувача
   * @param {number|string|Decimal} amount - Сума списання
   * @param {Object} [tx] - Об'єкт транзакції Prisma
   * @returns {Promise<Object>} Оновлений гаманець
   */
  async burnFunds(userId, amount, tx) {
    const targetUserId = Number.parseInt(userId, 10);
    const decAmount = new Prisma.Decimal(amount);
    const client = tx || prisma;

    if (decAmount.lt(0)) {
      throw createError.invalidAmount();
    }

    if (decAmount.isZero()) {
      return this.getWallet(userId);
    }

    const wallet = await this._getOrCreateLockedWallet(targetUserId, client);

    const balance = new Prisma.Decimal(wallet.balance);
    if (balance.lt(decAmount)) {
      throw createError.insufficientFunds();
    }

    const newBalance = balance.minus(decAmount);

    const updatedWallet = await client.wallet.update({
      where: { id: wallet.id },
      data: { balance: newBalance },
    });

    await client.transaction.create({
      data: {
        walletId: wallet.id,
        amount: decAmount,
        type: 'SYSTEM_WRITE_OFF',
      },
    });

    return updatedWallet;
  }

  /**
   * Отримання історії транзакцій та активних бронювань
   * @param {number} userId - ID користувача
   * @param {Object} paginationOptions - Параметри пагінації
   * @param {number} [paginationOptions.limit=20] - Кількість записів
   * @param {number} [paginationOptions.offset=0] - Зсув
   * @returns {Promise<Object>} Історія та активні транзакції
   */
  async getTransactionHistory(userId, { limit = 20, offset = 0 } = {}) {
    const targetUserId = Number.parseInt(userId, 10);
    const wallet = await this.getWallet(targetUserId);

    const take = Number.parseInt(limit, 10);
    const skip = Number.parseInt(offset, 10);

    const [history, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { date: 'desc' },
        skip,
        take,
      }),
      prisma.transaction.count({
        where: { walletId: wallet.id },
      }),
    ]);
    
    const historySessionIds = [...new Set(history.map((tx) => tx.sessionId).filter(Boolean))];
    let historySessionsMap = new Map();
    if (historySessionIds.length > 0) {
      const historySessions = await prisma.session.findMany({
        where: { id: { in: historySessionIds } },
        select: { id: true, title: true },
      });
      historySessions.forEach((s) => historySessionsMap.set(s.id, s));
    }

    const historyWithSessions = history.map((tx) => ({
      ...tx,
      session: tx.sessionId ? (historySessionsMap.get(tx.sessionId) || null) : null,
    }));

    const reserveTransactions = await prisma.transaction.findMany({
      where: {
        walletId: wallet.id,
        type: 'RESERVE',
        sessionId: { not: null },
      },
      orderBy: { date: 'desc' },
    });

    let activeTransactions = [];
    const sessionIds = reserveTransactions.map((tx) => tx.sessionId).filter(Boolean);

    if (sessionIds.length > 0) {
      const activeSessions = await prisma.session.findMany({
        where: {
          id: { in: sessionIds },
          status: { in: ['PLANNED', 'ACTIVE'] },
        },
        select: { id: true, title: true, status: true, date: true },
      });

      const activeSessionIds = new Set(activeSessions.map((s) => s.id));
      const activeSessionsMap = new Map(activeSessions.map((s) => [s.id, s]));

      activeTransactions = reserveTransactions
        .filter((tx) => activeSessionIds.has(tx.sessionId))
        .map((tx) => ({
          ...tx,
          session: activeSessionsMap.get(tx.sessionId),
        }));
    }

    return {
      history: historyWithSessions,
      activeTransactions,
      pagination: {
        total,
        limit: take,
        offset: skip,
      },
    };
  }
}

module.exports = new WalletService();
