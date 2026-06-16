'use strict';

const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');

/**
 * Перевіряє чи юзер є GM сесії (власник або підтверджений GM-учасник).
 */
async function assertSessionGm(sessionId, userId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      ownerId: true,
      participants: {
        where: { userId, role: 'GM', status: 'CONFIRMED' },
        select: { id: true },
      },
    },
  });

  if (!session) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Сесія не знайдена');
  }

  const isOwner = session.ownerId === userId;
  const isGm = session.participants.length > 0;

  if (!isOwner && !isGm) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Тільки GM може керувати бестіарієм');
  }

  return session;
}

const vttCreaturesService = {
  /**
   * Отримати всіх GM-істот для сесії (відсортовані по sortOrder).
   *
   * @param {number} sessionId
   * @param {number} gmUserId
   * @returns {Promise<object[]>}
   */
  async getCreatures(sessionId, gmUserId) {
    await assertSessionGm(sessionId, gmUserId);

    return prisma.vttGmCreature.findMany({
      where: { sessionId, gmUserId },
      orderBy: { sortOrder: 'asc' },
    });
  },

  /**
   * Додати нову GM-істоту до сесії.
   *
   * @param {number} sessionId
   * @param {number} gmUserId
   * @param {'MONSTER'|'HUMAN'} type
   * @returns {Promise<object>}
   */
  async addCreature(sessionId, gmUserId, type = 'MONSTER') {
    await assertSessionGm(sessionId, gmUserId);

    // Визначаємо наступний sortOrder
    const lastCreature = await prisma.vttGmCreature.findFirst({
      where: { sessionId, gmUserId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const sortOrder = lastCreature ? lastCreature.sortOrder + 1 : 0;

    return prisma.vttGmCreature.create({
      data: {
        gmUserId,
        sessionId,
        type: type === 'HUMAN' ? 'HUMAN' : 'MONSTER',
        name: type === 'MONSTER' ? 'Новий ворог' : 'Новий NPC',
        sortOrder,
      },
    });
  },

  /**
   * Оновити дані GM-істоти (whitelist полів).
   *
   * @param {number} creatureId
   * @param {number} sessionId
   * @param {number} gmUserId
   * @param {object} data
   * @returns {Promise<object>}
   */
  async updateCreature(creatureId, sessionId, gmUserId, data) {
    await assertSessionGm(sessionId, gmUserId);

    const creature = await prisma.vttGmCreature.findFirst({
      where: { id: creatureId, sessionId, gmUserId },
    });

    if (!creature) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Істота не знайдена');
    }

    const {
      name, level, characterClass, race, avatarUrl,
      hpCurrent, hpMax, tempHp, ac, speed,
      initiativeBonus, proficiencyBonus,
      hitDiceCurrent, hitDiceMax, hitDiceType,
      tokenBorderColor, sortOrder,
      stats, savingThrows, skills, coins, attacks,
    } = data;

    const payload = {
      ...(name !== undefined && { name }),
      ...(level !== undefined && { level: Number(level) }),
      ...(characterClass !== undefined && { characterClass }),
      ...(race !== undefined && { race }),
      ...(avatarUrl !== undefined && { avatarUrl }),
      ...(hpCurrent !== undefined && { hpCurrent: Number(hpCurrent) }),
      ...(hpMax !== undefined && { hpMax: Number(hpMax) }),
      ...(tempHp !== undefined && { tempHp: Number(tempHp) }),
      ...(ac !== undefined && { ac: Number(ac) }),
      ...(speed !== undefined && { speed: Number(speed) }),
      ...(initiativeBonus !== undefined && { initiativeBonus: Number(initiativeBonus) }),
      ...(proficiencyBonus !== undefined && { proficiencyBonus: Number(proficiencyBonus) }),
      ...(hitDiceCurrent !== undefined && { hitDiceCurrent: Number(hitDiceCurrent) }),
      ...(hitDiceMax !== undefined && { hitDiceMax: Number(hitDiceMax) }),
      ...(hitDiceType !== undefined && { hitDiceType }),
      ...(tokenBorderColor !== undefined && { tokenBorderColor }),
      ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      ...(stats !== undefined && { stats }),
      ...(savingThrows !== undefined && { savingThrows }),
      ...(skills !== undefined && { skills }),
      ...(coins !== undefined && { coins }),
      ...(attacks !== undefined && { attacks }),
    };

    return prisma.vttGmCreature.update({
      where: { id: creatureId },
      data: payload,
    });
  },

  /**
   * Видалити GM-істоту.
   *
   * @param {number} creatureId
   * @param {number} sessionId
   * @param {number} gmUserId
   * @returns {Promise<void>}
   */
  async removeCreature(creatureId, sessionId, gmUserId) {
    await assertSessionGm(sessionId, gmUserId);

    const creature = await prisma.vttGmCreature.findFirst({
      where: { id: creatureId, sessionId, gmUserId },
    });

    if (!creature) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Істота не знайдена');
    }

    await prisma.vttGmCreature.delete({ where: { id: creatureId } });
  },

  /**
   * Замінити весь список GM-істот (batch upsert для синхронізації зі store).
   * Використовується для bulk-збереження localStorage → БД.
   *
   * @param {number} sessionId
   * @param {number} gmUserId
   * @param {object[]} creatures  — масив з useGmCreaturesStore
   * @returns {Promise<object[]>}
   */
  async syncCreatures(sessionId, gmUserId, creatures) {
    await assertSessionGm(sessionId, gmUserId);

    if (!Array.isArray(creatures)) {
      throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'creatures має бути масивом');
    }

    // Видаляємо всіх поточних та вставляємо новий список
    await prisma.$transaction(async (tx) => {
      await tx.vttGmCreature.deleteMany({ where: { sessionId, gmUserId } });

      if (creatures.length > 0) {
        await tx.vttGmCreature.createMany({
          data: creatures.map((c, idx) => ({
            gmUserId,
            sessionId,
            type: c.type === 'HUMAN' ? 'HUMAN' : 'MONSTER',
            name: c.data?.name || 'Ворог',
            level: Number(c.data?.level) || 1,
            characterClass: c.data?.characterClass || null,
            race: c.data?.race || null,
            avatarUrl: c.data?.avatarUrl || null,
            hpCurrent: Number(c.data?.hpCurrent) || 10,
            hpMax: Number(c.data?.hpMax) || 10,
            tempHp: Number(c.data?.tempHp) || 0,
            ac: Number(c.data?.ac) || 10,
            speed: Number(c.data?.speed) || 30,
            initiativeBonus: Number(c.data?.initiativeBonus) || 0,
            proficiencyBonus: Number(c.data?.proficiencyBonus) || 2,
            hitDiceCurrent: Number(c.data?.hitDiceCurrent) || 1,
            hitDiceMax: Number(c.data?.hitDiceMax) || 1,
            hitDiceType: c.data?.hitDiceType || 'd8',
            tokenBorderColor: c.data?.tokenBorderColor || '#ef4444',
            sortOrder: idx,
            stats: c.data?.stats || {},
            savingThrows: c.data?.savingThrows || {},
            skills: c.data?.skills || {},
            coins: c.data?.coins || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
            attacks: c.data?.attacks || [],
          })),
        });
      }
    });

    return vttCreaturesService.getCreatures(sessionId, gmUserId);
  },
};

module.exports = vttCreaturesService;
