'use strict';

const { prisma } = require('../lib/prisma');
const { logger } = require('../lib/logger');

/**
 * vtt-scene.service.js
 *
 * Відповідає за збереження/відновлення стану VTT (сцени, шари, токени,
 * ініціатива) між in-memory VttStateManager та PostgreSQL.
 *
 * Підхід: "in-memory first" — усі мутації відбуваються в пам'яті (швидко),
 * БД отримує snapshot при автозбереженні (кожні 5 хв + при closeVtt).
 */

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Конвертує число-колір у HEX-рядок для зберігання (0x9dc88d → '#9dc88d').
 * @param {number|string|null} color
 * @returns {string}
 */
function colorToHex(color) {
  if (color == null) return '#9dc88d';
  if (typeof color === 'string' && color.startsWith('#')) return color;
  return `#${Number(color).toString(16).padStart(6, '0')}`;
}

/**
 * Конвертує HEX або рядок у число (для зберігання в БД як Int).
 * @param {number|string|null} color
 * @returns {number}
 */
function colorToInt(color) {
  if (color == null) return 0x9dc88d;
  if (typeof color === 'number') return color;
  if (typeof color === 'string' && color.startsWith('#'))
    return Number.parseInt(color.slice(1), 16);
  return 0x9dc88d;
}

// ─── Room ──────────────────────────────────────────────────────────────────

/**
 * Отримати або створити VttRoom для сесії.
 * @param {number} sessionId
 * @returns {Promise<object>} VttRoom
 */
async function ensureRoom(sessionId) {
  let room = await prisma.vttRoom.findUnique({ where: { sessionId } });
  if (!room) {
    room = await prisma.vttRoom.create({
      data: { sessionId },
    });
    logger.info({ sessionId }, '[VttScene] VttRoom created');
  }
  return room;
}

// ─── Load ──────────────────────────────────────────────────────────────────

/**
 * Завантажити повний стан VTT з БД та сконвертувати у формат VttStateManager.
 *
 * Викликається при `vtt:open` — гідрує in-memory стан якщо він порожній.
 *
 * @param {number} sessionId
 * @param {number|null} campaignId — якщо сесія у кампанії
 * @returns {Promise<{
 *   scenes: Record<string, object>,
 *   activeSceneId: string|null,
 *   initiative: object[],
 * }>}
 */
async function loadVttState(sessionId, campaignId = null) {
  const room = await ensureRoom(sessionId);

  // Завантажуємо сцени: для кампанії — campaign-level, інакше — прив'язані до room
  let dbScenes;
  if (campaignId) {
    dbScenes = await prisma.vttScene.findMany({
      where: { campaignId },
      include: { layers: { include: { items: true }, orderBy: { sortOrder: 'asc' } }, tokens: true },
      orderBy: { sortOrder: 'asc' },
    });
  } else {
    dbScenes = await prisma.vttScene.findMany({
      where: { roomId: room.id },
      include: { layers: { include: { items: true }, orderBy: { sortOrder: 'asc' } }, tokens: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // Завантажуємо ініціативу
  const dbInitiative = await prisma.vttInitiativeEntry.findMany({
    where: { roomId: room.id },
    orderBy: { sortOrder: 'asc' },
  });

  // Конвертуємо DB-сцени → формат in-memory
  const scenes = {};
  let activeSceneId = null;

  for (const dbScene of dbScenes) {
    const sceneKey = dbScene.sceneKey;

    const layers = dbScene.layers.map((dbLayer, lIdx) => ({
      id: dbLayer.layerKey,
      name: dbLayer.name,
      type: dbLayer.type,
      isVisible: dbLayer.isVisible,
      isLocked: dbLayer.isLocked,
      opacity: dbLayer.opacity,
      sortOrder: lIdx,
      items: dbLayer.items.map((item) => {
        if (item.type === 'IMAGE') {
          return {
            id: item.itemKey,
            type: 'IMAGE',
            url: item.url,
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            scaleX: item.scaleX,
            scaleY: item.scaleY,
            rotation: item.rotation,
          };
        }
        // DRAWING
        return {
          id: item.itemKey,
          type: 'DRAWING',
          points: item.points,
          color: item.color,
          thickness: item.thickness,
          drawTool: item.drawTool,
          userId: item.authorId ? String(item.authorId) : null,
        };
      }),
    }));

    const tokens = {};
    for (const dbToken of dbScene.tokens) {
      tokens[dbToken.tokenKey] = {
        id: dbToken.tokenKey,
        type: dbToken.type,
        name: dbToken.name,
        avatarUrl: dbToken.avatarUrl,
        x: dbToken.x,
        y: dbToken.y,
        size: dbToken.size,
        color: dbToken.color,
        hpCurrent: dbToken.hpCurrent,
        hpMax: dbToken.hpMax,
        isVisible: dbToken.isVisible,
        ...(dbToken.characterSheetId && { characterSheetId: dbToken.characterSheetId }),
        ...(dbToken.gmCreatureId && { gmCreatureId: dbToken.gmCreatureId }),
      };
    }

    scenes[sceneKey] = {
      id: sceneKey,
      name: dbScene.name,
      width: dbScene.width,
      height: dbScene.height,
      gridSize: dbScene.gridSize,
      backgroundColor: dbScene.backgroundColor,
      gridEnabled: dbScene.gridEnabled,
      gridType: dbScene.gridType,
      gridColor: dbScene.gridColor,
      gridOpacity: dbScene.gridOpacity,
      gridScale: dbScene.gridScale,
      tokens,
      layers,
    };

    if (dbScene.isActive || String(dbScene.id) === String(room.activeSceneId)) {
      activeSceneId = sceneKey;
    }
  }

  // Якщо activeSceneId не встановлений — беремо першу сцену
  if (!activeSceneId && Object.keys(scenes).length > 0) {
    activeSceneId = Object.keys(scenes)[0];
  }

  const initiative = dbInitiative.map((e) => ({
    id: e.entryKey,
    name: e.name,
    value: e.value,
    sortOrder: e.sortOrder,
  }));

  logger.info({ sessionId, sceneCount: dbScenes.length }, '[VttScene] State loaded from DB');

  return { scenes, activeSceneId, initiative };
}

// ─── Save (Snapshot) ────────────────────────────────────────────────────────

/**
 * Зберегти поточний in-memory стан у БД (snapshot).
 * Повністю замінює сцени/шари/items для даної кімнати.
 * Використовує транзакцію для консистентності.
 *
 * @param {number} sessionId
 * @param {number|null} campaignId
 * @param {object} vttState — { scenes, activeSceneId, initiative }
 * @returns {Promise<void>}
 */
async function saveVttState(sessionId, campaignId, vttState) {
  const { scenes = {}, activeSceneId, initiative = [] } = vttState;

  logger.info({ sessionId, sceneCount: Object.keys(scenes).length }, '[VttScene] Saving state to DB...');

  const room = await ensureRoom(sessionId);

  await prisma.$transaction(async (tx) => {
    // Знаходимо ID активної сцени (по sceneKey → dbScene.id)
    let activeDbSceneId = null;

    // ── Сцени ──────────────────────────────────────────────────────────────

    if (campaignId) {
      // Campaign-level: синхронізуємо сцени кампанії
      await tx.vttScene.deleteMany({ where: { campaignId } });
    } else {
      // Session-level
      await tx.vttScene.deleteMany({ where: { roomId: room.id } });
    }

    let sceneOrder = 0;
    for (const [sceneKey, scene] of Object.entries(scenes)) {
      const isActive = sceneKey === activeSceneId;

      const dbScene = await tx.vttScene.create({
        data: {
          sceneKey,
          name: scene.name || 'New Scene',
          width: scene.width || 2048,
          height: scene.height || 2048,
          gridSize: scene.gridSize || 64,
          backgroundColor: colorToInt(scene.backgroundColor),
          gridEnabled: scene.gridEnabled !== false,
          gridType: scene.gridType === 'HEXAGONAL' ? 'HEXAGONAL' : 'SQUARE',
          gridColor: colorToInt(scene.gridColor),
          gridOpacity: scene.gridOpacity ?? 0.4,
          gridScale: scene.gridScale ?? 5,
          isActive,
          sortOrder: sceneOrder++,
          ...(campaignId ? { campaignId } : { roomId: room.id }),
        },
      });

      if (isActive) activeDbSceneId = dbScene.id;

      // ── Шари ─────────────────────────────────────────────────────────────
      const layers = Array.isArray(scene.layers) ? scene.layers : [];
      let layerOrder = 0;

      for (const layer of layers) {
        const dbLayer = await tx.vttLayer.create({
          data: {
            layerKey: layer.id,
            name: layer.name || 'Layer',
            type: layer.type || 'GENERIC',
            isVisible: layer.isVisible !== false,
            isLocked: layer.isLocked === true,
            opacity: layer.opacity ?? 1.0,
            sortOrder: layerOrder++,
            sceneId: dbScene.id,
          },
        });

        // ── Items ───────────────────────────────────────────────────────────
        const items = Array.isArray(layer.items) ? layer.items : [];
        if (items.length > 0) {
          await tx.vttLayerItem.createMany({
            data: items.map((item) => {
              if (item.type === 'DRAWING') {
                return {
                  itemKey: item.id,
                  type: 'DRAWING',
                  points: item.points || null,
                  color: item.color || null,
                  thickness: item.thickness || null,
                  drawTool: item.drawTool || null,
                  layerId: dbLayer.id,
                  authorId: item.userId ? Number(item.userId) || null : null,
                };
              }
              // IMAGE
              return {
                itemKey: item.id,
                type: 'IMAGE',
                url: item.url || null,
                x: item.x ?? 0,
                y: item.y ?? 0,
                width: item.width || null,
                height: item.height || null,
                scaleX: item.scaleX ?? 1,
                scaleY: item.scaleY ?? 1,
                rotation: item.rotation ?? 0,
                layerId: dbLayer.id,
              };
            }),
          });
        }
      }

      // ── Токени ───────────────────────────────────────────────────────────
      const tokens = scene.tokens ? Object.values(scene.tokens) : [];
      if (tokens.length > 0) {
        await tx.vttToken.createMany({
          data: tokens.map((token) => ({
            tokenKey: token.id,
            type: ['PLAYER', 'MONSTER', 'NPC', 'GENERIC'].includes(token.type) ? token.type : 'GENERIC',
            name: token.name || null,
            avatarUrl: token.avatarUrl || null,
            x: token.x ?? 0,
            y: token.y ?? 0,
            size: token.size ?? 1,
            color: token.color || null,
            hpCurrent: token.hpCurrent || null,
            hpMax: token.hpMax || null,
            isVisible: token.isVisible !== false,
            sceneId: dbScene.id,
            characterSheetId: token.characterSheetId || null,
            gmCreatureId: token.gmCreatureId || null,
          })),
        });
      }
    }

    // ── Ініціатива ─────────────────────────────────────────────────────────
    await tx.vttInitiativeEntry.deleteMany({ where: { roomId: room.id } });

    if (initiative.length > 0) {
      await tx.vttInitiativeEntry.createMany({
        data: initiative.map((entry, idx) => ({
          entryKey: String(entry.id || `entry-${idx}`),
          name: entry.name || '?',
          value: Number(entry.value) || 0,
          sortOrder: idx,
          roomId: room.id,
        })),
      });
    }

    // ── Оновлюємо lastSavedAt та activeSceneId ─────────────────────────────
    await tx.vttRoom.update({
      where: { id: room.id },
      data: {
        lastSavedAt: new Date(),
        activeSceneId: activeDbSceneId,
      },
    });
  });

  logger.info({ sessionId }, '[VttScene] State saved to DB ✓');
}

// ─── Dice Log ──────────────────────────────────────────────────────────────

/**
 * Асинхронно зберегти кидок кубиків у БД.
 * НЕ блокує WS-обробник — викликається без await.
 *
 * @param {number} sessionId
 * @param {object} rollEntry — з vttStateManager.addDiceRoll
 * @param {number|null} initiatorId
 * @returns {Promise<void>}
 */
async function saveDiceRoll(sessionId, rollEntry, initiatorId) {
  try {
    const room = await ensureRoom(sessionId);

    await prisma.vttDiceRoll.create({
      data: {
        rollKey: String(rollEntry.id),
        formula: String(rollEntry.formula || '1d20'),
        total: Number(rollEntry.total) || 0,
        details: rollEntry.results || rollEntry.details || [],
        player: String(rollEntry.player || 'Гравець'),
        characterName: rollEntry.characterName || null,
        name: rollEntry.name || null,
        strength: Number(rollEntry.strength) || 1,
        visibility: rollEntry.visibility === 'GM_ONLY' ? 'GM_ONLY' : 'PUBLIC',
        roomId: room.id,
        initiatorId: initiatorId ? Number(initiatorId) : null,
        rolledAt: rollEntry.timestamp ? new Date(rollEntry.timestamp) : new Date(),
      },
    });
  } catch (err) {
    logger.error({ err, sessionId }, '[VttScene] Failed to save dice roll to DB');
  }
}

/**
 * Отримати лог кидків кубиків з БД (для REST API).
 *
 * @param {number} sessionId
 * @param {number} [limit=50]
 * @returns {Promise<object[]>}
 */
async function getDiceLog(sessionId, limit = 50) {
  const room = await prisma.vttRoom.findUnique({ where: { sessionId } });
  if (!room) return [];

  return prisma.vttDiceRoll.findMany({
    where: { roomId: room.id },
    orderBy: { rolledAt: 'desc' },
    take: limit,
    include: {
      initiator: { select: { id: true, username: true } },
    },
  });
}

module.exports = {
  ensureRoom,
  loadVttState,
  saveVttState,
  saveDiceRoll,
  getDiceLog,
};
