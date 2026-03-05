require('dotenv').config(); // <-- Додай це сюди
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SEED_PREFIX = '[SEED]';
const TEST_PASSWORD = 'Test12345!';

// Залишаємо базових юзерів (Адмін, 2 Майстра, 8 Гравців)
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
 * Отримує дату для конкретного дня поточного тижня
 * @param {number} dayIndex 0 = Понеділок, 1 = Вівторок ... 6 = Неділя
 */
function getDayOfCurrentWeek(dayIndex, hours = 19, minutes = 0) {
  const now = new Date();
  const currentDay = now.getDay();
  // Переводимо неділю(0) в кінець тижня, щоб понеділок був 0, а неділя 6
  const jsDayToMondayFirst = currentDay === 0 ? 6 : currentDay - 1;
  const diff = dayIndex - jsDayToMondayFirst;

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + diff);
  targetDate.setHours(hours, minutes, 0, 0);
  return targetDate;
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

  const campaign3 = await prisma.campaign.create({
    data: { title: `${SEED_PREFIX} Iron Frontier`, description: 'Sci-fi', system: 'Pathfinder 2e', visibility: 'PRIVATE', ownerId: usersByKey.gm1.id },
  });

  // Додаємо учасників базово
  await prisma.campaignMember.createMany({
    data: [
      { campaignId: campaign1.id, userId: usersByKey.gm1.id, role: 'OWNER' },
      { campaignId: campaign1.id, userId: usersByKey.player1.id, role: 'PLAYER' },
      { campaignId: campaign1.id, userId: usersByKey.player2.id, role: 'PLAYER' },
      { campaignId: campaign2.id, userId: usersByKey.gm2.id, role: 'OWNER' },
      { campaignId: campaign2.id, userId: usersByKey.player3.id, role: 'PLAYER' },
      { campaignId: campaign3.id, userId: usersByKey.gm1.id, role: 'OWNER' },
      { campaignId: campaign3.id, userId: usersByKey.player4.id, role: 'PLAYER' },
    ],
  });

  return [campaign1, campaign2, campaign3];
}

async function createDynamicWeekSessions(usersByKey, campaigns) {
  const now = new Date();
  const currentDayIndex = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0-6 (Пн-Нд)
  
  const sessionsData = [];

  // Генеруємо по 2 сесії на кожен день поточного тижня
  for (let day = 0; day <= 6; day++) {
    const isPast = day < currentDayIndex;
    const isToday = day === currentDayIndex;
    
    // Сесія 1: Зазвичай кампанія 1 (D&D)
    const time1 = getDayOfCurrentWeek(day, 18, 0); // 18:00
    let status1 = 'PLANNED';
    if (isPast) status1 = 'FINISHED';
    if (isToday && now > time1) status1 = 'ACTIVE';

    sessionsData.push({
      title: `${SEED_PREFIX} D&D Session (Day ${day + 1})`,
      date: time1,
      duration: 180,
      status: status1,
      visibility: 'PUBLIC',
      system: 'D&D 5e',
      campaignId: campaigns[0].id,
      ownerId: usersByKey.gm1.id,
    });

    // Сесія 2: Зазвичай кампанія 2 (Call of Cthulhu)
    const time2 = getDayOfCurrentWeek(day, 20, 30); // 20:30
    let status2 = 'PLANNED';
    if (isPast) status2 = day % 2 === 0 ? 'FINISHED' : 'CANCELED'; // Трохи різноманіття
    if (isToday && now > time2) status2 = 'ACTIVE';

    sessionsData.push({
      title: `${SEED_PREFIX} CoC Session (Day ${day + 1})`,
      date: time2,
      duration: 240,
      status: status2,
      visibility: 'PUBLIC',
      system: 'Call of Cthulhu',
      campaignId: campaigns[1].id,
      ownerId: usersByKey.gm2.id,
    });
  }

  // Створюємо всі сесії
  const createdSessions = [];
  for (const data of sessionsData) {
    const session = await prisma.session.create({ data });
    createdSessions.push(session);
    
    // Додаємо учасників до кожної сесії
    const participants = [
      { sessionId: session.id, userId: data.ownerId, role: 'GM', status: data.status === 'FINISHED' ? 'ATTENDED' : 'CONFIRMED' },
      { sessionId: session.id, userId: usersByKey.player1.id, role: 'PLAYER', status: data.status === 'FINISHED' ? 'ATTENDED' : 'CONFIRMED' },
      { sessionId: session.id, userId: usersByKey.player2.id, role: 'PLAYER', status: data.status === 'FINISHED' ? 'NO_SHOW' : 'PENDING' },
    ];
    await prisma.sessionParticipant.createMany({ data: participants });
  }
}

async function main() {
  console.log('🌱 Запуск MVP сидингу...');
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  await cleanupPreviousSeedData();
  const usersByKey = await upsertUsersAndProfiles(passwordHash);
  const campaigns = await createCampaigns(usersByKey);
  await createDynamicWeekSessions(usersByKey, campaigns);

  console.log('✅ Сидинг завершено! Календар на цей тиждень заповнено.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });