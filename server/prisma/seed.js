const path = require('node:path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { logger } = require('../src/lib/logger');
const { createRawEncryptedAndHashedShareToken } = require('../src/utils/token.helper');

const prisma = new PrismaClient();

const SEED_PREFIX = '[SEED]';
const TEST_PASSWORD = 'Test12345!';

const usersSeed = [
  { key: 'admin', email: 'admin@seed.ttrpg.local', username: 'seed_admin', role: 'ADMIN', displayName: 'Seed Admin', timezone: 'Europe/Kyiv' },
  { key: 'gm1', email: 'gm.alex@seed.ttrpg.local', username: 'seed_gm_alex', role: 'USER', displayName: 'Alex GM', timezone: 'Europe/Kyiv' },
  { key: 'gm2', email: 'gm.maria@seed.ttrpg.local', username: 'seed_gm_maria', role: 'USER', displayName: 'Maria Storyteller', timezone: 'Europe/Kyiv' },
  { key: 'player1', email: 'player.ivan@seed.ttrpg.local', username: 'seed_player_ivan', role: 'USER', displayName: 'Ivan Rogue', timezone: 'Europe/Kyiv' },
  { key: 'player2', email: 'player.anna@seed.ttrpg.local', username: 'seed_player_anna', role: 'USER', displayName: 'Anna Cleric', timezone: 'Europe/Kyiv' },
  { key: 'player3', email: 'player.dmytro@seed.ttrpg.local', username: 'seed_player_dmytro', role: 'USER', displayName: 'Dmytro Ranger', timezone: 'Europe/Kyiv' },
  { key: 'player4', email: 'player.olha@seed.ttrpg.local', username: 'seed_player_olha', role: 'USER', displayName: 'Olha Bard', timezone: 'Europe/Kyiv' },
  { key: 'player5', email: 'player.mykola@seed.ttrpg.local', username: 'seed_player_mykola', role: 'USER', displayName: 'Mykola Fighter', timezone: 'Europe/Kyiv' },
  { key: 'player6', email: 'player.sofia@seed.ttrpg.local', username: 'seed_player_sofia', role: 'USER', displayName: 'Sofia Druid', timezone: 'Europe/Kyiv' },
  { key: 'player7', email: 'player.vlad@seed.ttrpg.local', username: 'seed_player_vlad', role: 'USER', displayName: 'Vlad Wizard', timezone: 'Europe/Kyiv' },
  { key: 'player8', email: 'player.kate@seed.ttrpg.local', username: 'seed_player_kate', role: 'USER', displayName: 'Kate Monk', timezone: 'Europe/Kyiv' },
];

/**
 * @param {number} dayIndex
 */
function getDayOfCurrentWeek(dayIndex, hours = 19, minutes = 0) {
  const now = new Date();
  const currentDay = now.getDay();

  const jsDayToMondayFirst = currentDay === 0 ? 6 : currentDay - 1;
  const diff = dayIndex - jsDayToMondayFirst;

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
}

function getCurrentDayIndex(now = new Date()) {
  return now.getDay() === 0 ? 6 : now.getDay() - 1;
}

function resolveSessionStatus({ now, currentDayIndex, day, sessionDate, pastDayStatus = 'FINISHED' }) {
  const isPast = day < currentDayIndex;
  const isToday = day === currentDayIndex;

  if (isToday && now > sessionDate) {
    return 'ACTIVE';
  }

  if (isPast) {
    return typeof pastDayStatus === 'function' ? pastDayStatus(day) : pastDayStatus;
  }

  return 'PLANNED';
}

function buildWeeklyCampaignSessions({ now, currentDayIndex, usersByKey, campaigns }) {
  return Array.from({ length: 7 }, (_, day) => {
    const dndDate = getDayOfCurrentWeek(day, 18, 0);
    const cocDate = getDayOfCurrentWeek(day, 20, 30);

    return [
      {
        title: `${SEED_PREFIX} D&D Session (Day ${day + 1})`,
        date: dndDate,
        duration: 180,
        status: resolveSessionStatus({ now, currentDayIndex, day, sessionDate: dndDate }),
        visibility: day % 2 === 0 ? 'PRIVATE' : 'PUBLIC',
        system: 'D&D 5e',
        campaignId: campaigns[0].id,
        ownerId: usersByKey.gm1.id,
      },
      {
        title: `${SEED_PREFIX} CoC Session (Day ${day + 1})`,
        date: cocDate,
        duration: 240,
        status: resolveSessionStatus({
          now,
          currentDayIndex,
          day,
          sessionDate: cocDate,
          pastDayStatus: (dayIndex) => (dayIndex % 2 === 0 ? 'FINISHED' : 'CANCELED'),
        }),
        visibility: 'PUBLIC',
        system: 'Call of Cthulhu',
        campaignId: campaigns[1].id,
        ownerId: usersByKey.gm2.id,
      },
    ];
  }).flat();
}

function buildDefaultParticipants({ data, sessionId, usersByKey }) {
  return [
    { userId: data.ownerId, role: 'GM', status: 'CONFIRMED' },
    { userId: usersByKey.player1.id, role: 'PLAYER', status: 'CONFIRMED' },
    {
      userId: usersByKey.player2.id,
      role: 'PLAYER',
      status: data.status === 'FINISHED' ? 'DECLINED' : 'PENDING',
    },
  ].map((participant) => ({
    sessionId,
    ...participant,
  }));
}

function buildParticipantsForSession({ data, sessionId, usersByKey }) {
  if (data.extraParticipants) {
    return data.extraParticipants.map((participant) => ({
      sessionId,
      ...participant,
    }));
  }

  return buildDefaultParticipants({ data, sessionId, usersByKey });
}

async function cleanupPreviousSeedData() {
  const seededCampaigns = await prisma.campaign.findMany({
    where: { title: { startsWith: SEED_PREFIX } },
    select: { id: true },
  });
  const seededCampaignIds = seededCampaigns.map((c) => c.id);

  const seededSessions = await prisma.session.findMany({
    where: { OR: [{ title: { startsWith: SEED_PREFIX } }, { campaignId: { in: seededCampaignIds } }] },
    select: { id: true },
  });
  const seededSessionIds = seededSessions.map((s) => s.id);

  if (seededSessionIds.length > 0) {
    await prisma.sessionParticipant.deleteMany({ where: { sessionId: { in: seededSessionIds } } });
    await prisma.session.deleteMany({ where: { id: { in: seededSessionIds } } });
  }

  if (seededCampaignIds.length > 0) {
    await prisma.joinRequest.deleteMany({ where: { campaignId: { in: seededCampaignIds } } });
    await prisma.campaignMember.deleteMany({ where: { campaignId: { in: seededCampaignIds } } });
    await prisma.campaign.deleteMany({ where: { id: { in: seededCampaignIds } } });
  }
}

async function upsertUsersAndProfiles(passwordHash) {
  const usersByKey = {};
  for (const seedUser of usersSeed) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { username: seedUser.username, password: passwordHash, role: seedUser.role },
      create: { email: seedUser.email, username: seedUser.username, password: passwordHash, role: seedUser.role, displayName: seedUser.displayName, timezone: seedUser.timezone, emailVerified: true },
    });
    usersByKey[seedUser.key] = user;
  }
  return usersByKey;
}

async function createCampaigns(usersByKey) {
  const campaign1 = await prisma.campaign.create({
    data: { title: `${SEED_PREFIX} Curse of the Emerald Crown`, description: 'D&D 5e кампанія', system: 'D&D 5e', visibility: 'PUBLIC', ownerId: usersByKey.gm1.id },
  });

  const campaign2 = await prisma.campaign.create({
    data: { title: `${SEED_PREFIX} Shadows over Kyiv`, description: 'Містика', system: 'Call of Cthulhu', visibility: 'PUBLIC', ownerId: usersByKey.gm2.id },
  });

  const campaign3ShareToken = createRawEncryptedAndHashedShareToken();
  const campaign3 = await prisma.campaign.create({
    data: {
      title: `${SEED_PREFIX} Iron Frontier`,
      description: 'Sci-fi',
      system: 'Pathfinder 2e',
      visibility: 'LINK_ONLY',
      shareTokenHash: campaign3ShareToken.tokenHash,
      shareTokenEncrypted: campaign3ShareToken.tokenEncrypted,
      shareTokenCreatedAt: new Date(),
      ownerId: usersByKey.gm1.id,
    },
  });

  const campaign4 = await prisma.campaign.create({
    data: {
      title: `${SEED_PREFIX} Frozen Ashes Chronicle`,
      description: 'Завершена кампанія для перевірки lifecycle правил',
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      status: 'FINISHED',
      ownerId: usersByKey.gm2.id,
    },
  });

  await prisma.campaignMember.createMany({
    data: [
      { campaignId: campaign1.id, userId: usersByKey.gm1.id, role: 'OWNER' },
      { campaignId: campaign1.id, userId: usersByKey.gm2.id, role: 'GM' },
      { campaignId: campaign1.id, userId: usersByKey.player1.id, role: 'PLAYER' },
      { campaignId: campaign1.id, userId: usersByKey.player2.id, role: 'PLAYER' },
      { campaignId: campaign2.id, userId: usersByKey.gm2.id, role: 'OWNER' },
      { campaignId: campaign2.id, userId: usersByKey.player3.id, role: 'PLAYER' },
      { campaignId: campaign3.id, userId: usersByKey.gm1.id, role: 'OWNER' },
      { campaignId: campaign3.id, userId: usersByKey.player4.id, role: 'PLAYER' },
      { campaignId: campaign4.id, userId: usersByKey.gm2.id, role: 'OWNER' },
      { campaignId: campaign4.id, userId: usersByKey.player3.id, role: 'PLAYER' },
    ],
  });

  return [campaign1, campaign2, campaign3, campaign4];
}

async function createDynamicWeekSessions(usersByKey, campaigns) {
  const now = new Date();
  const currentDayIndex = getCurrentDayIndex(now); // 0-6 (Пн-Нд)
  const sessionsData = [
    ...buildWeeklyCampaignSessions({ now, currentDayIndex, usersByKey, campaigns }),
    {
      title: `${SEED_PREFIX} One-shot Public`,
      date: getDayOfCurrentWeek((currentDayIndex + 1) % 7, 15, 0),
      duration: 180,
      status: 'PLANNED',
      visibility: 'PUBLIC',
      system: 'D&D 5e',
      campaignId: null,
      ownerId: usersByKey.gm1.id,
      extraParticipants: [
        { userId: usersByKey.gm1.id, role: 'GM', status: 'CONFIRMED' },
      ],
    },
    {
      title: `${SEED_PREFIX} One-shot Private`,
      date: getDayOfCurrentWeek((currentDayIndex + 2) % 7, 16, 30),
      duration: 180,
      status: 'PLANNED',
      visibility: 'PRIVATE',
      system: 'Pathfinder 2e',
      campaignId: null,
      ownerId: usersByKey.gm2.id,
      extraParticipants: [
        { userId: usersByKey.gm2.id, role: 'GM', status: 'CONFIRMED' },
      ],
    },
    {
      title: `${SEED_PREFIX} One-shot Link Only`,
      date: getDayOfCurrentWeek((currentDayIndex + 3) % 7, 19, 0),
      duration: 240,
      status: 'PLANNED',
      visibility: 'LINK_ONLY',
      system: 'Call of Cthulhu',
      campaignId: null,
      ownerId: usersByKey.gm1.id,
      extraParticipants: [
        { userId: usersByKey.gm1.id, role: 'GM', status: 'CONFIRMED' },
      ],
    },
    {
      title: `${SEED_PREFIX} Ref Campaign Private Planned`,
      date: getDayOfCurrentWeek((currentDayIndex + 1) % 7, 21, 0),
      duration: 180,
      status: 'PLANNED',
      visibility: 'PRIVATE',
      system: 'D&D 5e',
      campaignId: campaigns[0].id,
      ownerId: usersByKey.gm1.id,
      extraParticipants: [
        { userId: usersByKey.gm1.id, role: 'GM', status: 'CONFIRMED' },
        { userId: usersByKey.player5.id, role: 'PLAYER', status: 'CONFIRMED' },
        { userId: usersByKey.player6.id, role: 'PLAYER', status: 'PENDING' },
        { userId: usersByKey.gm2.id, role: 'GM', status: 'PENDING' },
      ],
    },
    {
      title: `${SEED_PREFIX} Ref Campaign Public Active`,
      date: getDayOfCurrentWeek(currentDayIndex, 12, 0),
      duration: 180,
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      system: 'Call of Cthulhu',
      campaignId: campaigns[1].id,
      ownerId: usersByKey.gm2.id,
      extraParticipants: [
        { userId: usersByKey.gm2.id, role: 'GM', status: 'CONFIRMED' },
        { userId: usersByKey.player7.id, role: 'PLAYER', status: 'CONFIRMED' },
        { userId: usersByKey.player8.id, role: 'PLAYER', status: 'PENDING', isGuest: true },
      ],
    },
    {
      title: `${SEED_PREFIX} Ref Finished Campaign Session`,
      date: getDayOfCurrentWeek((currentDayIndex + 6) % 7, 19, 30),
      duration: 180,
      status: 'FINISHED',
      visibility: 'PRIVATE',
      system: 'D&D 5e',
      campaignId: campaigns[3].id,
      ownerId: usersByKey.gm2.id,
      extraParticipants: [
        { userId: usersByKey.gm2.id, role: 'GM', status: 'CONFIRMED' },
        { userId: usersByKey.player3.id, role: 'PLAYER', status: 'DECLINED' },
      ],
    },
    {
      title: `${SEED_PREFIX} Ref One-shot Canceled`,
      date: getDayOfCurrentWeek((currentDayIndex + 2) % 7, 22, 0),
      duration: 120,
      status: 'CANCELED',
      visibility: 'PUBLIC',
      system: 'Pathfinder 2e',
      campaignId: null,
      ownerId: usersByKey.gm1.id,
      extraParticipants: [
        { userId: usersByKey.gm1.id, role: 'GM', status: 'CONFIRMED' },
        { userId: usersByKey.player4.id, role: 'PLAYER', status: 'PENDING' },
      ],
    },
  ];

  for (const data of sessionsData) {
    const { extraParticipants, ...sessionData } = data;
    
    // Generate share token for LINK_ONLY sessions
    let sessionCreateData = { ...sessionData };
    if (sessionData.visibility === 'LINK_ONLY') {
      const shareTokenData = createRawEncryptedAndHashedShareToken();
      sessionCreateData = {
        ...sessionData,
        shareTokenHash: shareTokenData.tokenHash,
        shareTokenEncrypted: shareTokenData.tokenEncrypted,
        shareTokenCreatedAt: new Date(),
      };
    }
    
    const session = await prisma.session.create({ data: sessionCreateData });

    const participants = buildParticipantsForSession({
      data: { ...sessionData, extraParticipants },
      sessionId: session.id,
      usersByKey,
    });

    await prisma.sessionParticipant.createMany({ data: participants });
  }
}

async function main() {
  logger.info('Запуск MVP сидингу');
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  await cleanupPreviousSeedData();
  const usersByKey = await upsertUsersAndProfiles(passwordHash);
  const campaigns = await createCampaigns(usersByKey);
  await createDynamicWeekSessions(usersByKey, campaigns);

  logger.info('Сидинг завершено! Календар на цей тиждень заповнено.');
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Помилка сидингу');
    process.exit(1);
  })
  .finally(async () => { await prisma.$disconnect(); });
