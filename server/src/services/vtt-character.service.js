'use strict';

const { prisma } = require('../lib/prisma');
const { AppError, ERROR_CODES } = require('../constants/errors');

/**
 * Визначає ключ пошуку аркуша персонажа.
 *
 * Логіка:
 *   - Якщо сесія належить кампанії → персонаж прив'язаний до кампанії (shared між сесіями)
 *   - Якщо standalone сесія → персонаж прив'язаний до конкретної сесії
 *
 * @param {{ campaignId: number|null }} session
 * @param {number} userId
 * @returns {{ campaignId: number } | { sessionId: number }}
 */
function resolveSheetKey(session, userId) {
  if (session.campaignId) {
    return { userId, campaignId: session.campaignId };
  }
  return { userId, sessionId: session.id };
}

/**
 * Перевіряє чи поточний юзер є учасником сесії (або GM).
 */
async function assertSessionParticipant(sessionId, userId) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      ownerId: true,
      campaignId: true,
      participants: {
        where: { userId },
        select: { id: true, status: true },
      },
    },
  });

  if (!session) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, 'Сесія не знайдена');
  }

  const isOwner = session.ownerId === userId;
  const isParticipant = session.participants.some((p) => p.status === 'CONFIRMED');

  if (!isOwner && !isParticipant) {
    throw new AppError(ERROR_CODES.SECURITY_ACCESS_DENIED, 'Ви не є учасником цієї сесії');
  }

  return session;
}

const vttCharacterService = {
  /**
   * Отримати аркуш персонажа поточного гравця для сесії.
   * Повертає null якщо аркуша ще немає (треба показати форму створення).
   *
   * @param {number} sessionId
   * @param {number} userId
   * @returns {Promise<object|null>}
   */
  async getCharacterSheet(sessionId, userId) {
    const session = await assertSessionParticipant(sessionId, userId);
    const key = resolveSheetKey(session, userId);

    const sheet = await prisma.vttCharacterSheet.findFirst({
      where: key,
    });

    return sheet;
  },

  /**
   * Зберегти (upsert) аркуш персонажа.
   * Якщо аркуш ще не існує — створити, якщо існує — оновити.
   *
   * @param {number} sessionId
   * @param {number} userId
   * @param {object} data  — поля з useCharacterStore
   * @returns {Promise<object>}
   */
  async upsertCharacterSheet(sessionId, userId, data) {
    const session = await assertSessionParticipant(sessionId, userId);
    const key = resolveSheetKey(session, userId);

    // Whitelist дозволених полів
    const {
      name, level, characterClass, race, avatarUrl,
      hpCurrent, hpMax, tempHp, ac, speed,
      initiativeBonus, proficiencyBonus,
      hitDiceCurrent, hitDiceMax, hitDiceType,
      tokenBorderColor,
      stats, savingThrows, skills, coins, attacks,
      notes, features, backpack,
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
      ...(stats !== undefined && { stats }),
      ...(savingThrows !== undefined && { savingThrows }),
      ...(skills !== undefined && { skills }),
      ...(coins !== undefined && { coins }),
      ...(attacks !== undefined && { attacks }),
      ...(notes !== undefined && { notes }),
      ...(features !== undefined && { features }),
      ...(backpack !== undefined && { backpack }),
    };

    const existing = await prisma.vttCharacterSheet.findFirst({ where: key });

    if (existing) {
      return prisma.vttCharacterSheet.update({
        where: { id: existing.id },
        data: payload,
      });
    }

    // Створити новий
    const createData = {
      userId,
      ...payload,
    };

    if (key.campaignId) {
      createData.campaignId = key.campaignId;
    } else {
      createData.sessionId = key.sessionId;
    }

    return prisma.vttCharacterSheet.create({ data: createData });
  },
};

module.exports = vttCharacterService;
