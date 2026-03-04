const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

const SEED_PREFIX = '[SEED]';
const TEST_PASSWORD = 'Test12345!';

const usersSeed = [
  {
    key: 'admin',
    email: 'admin@seed.ttrpg.local',
    username: 'seed_admin',
    role: 'ADMIN',
    displayName: 'Seed Admin',
    bio: 'Адмін для тестування ролей і доступів',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    emailVerified: true,
    walletBalance: 500,
    stats: { hoursPlayed: 120, sessionsPlayed: 52 },
  },
  {
    key: 'gm1',
    email: 'gm.alex@seed.ttrpg.local',
    username: 'seed_gm_alex',
    role: 'USER',
    displayName: 'Alex GM',
    bio: 'Веду пригоди у світі фентезі',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    emailVerified: true,
    walletBalance: 260,
    stats: { hoursPlayed: 85, sessionsPlayed: 34 },
  },
  {
    key: 'gm2',
    email: 'gm.maria@seed.ttrpg.local',
    username: 'seed_gm_maria',
    role: 'USER',
    displayName: 'Maria Storyteller',
    bio: 'Полюбляю містику та горор-сюжети',
    timezone: 'Europe/Warsaw',
    language: 'uk',
    emailVerified: true,
    walletBalance: 180,
    stats: { hoursPlayed: 64, sessionsPlayed: 29 },
  },
  {
    key: 'player1',
    email: 'player.ivan@seed.ttrpg.local',
    username: 'seed_player_ivan',
    role: 'USER',
    displayName: 'Ivan Rogue',
    bio: 'Люблю складні моральні вибори',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    emailVerified: true,
    walletBalance: 90,
    stats: { hoursPlayed: 42, sessionsPlayed: 18 },
  },
  {
    key: 'player2',
    email: 'player.anna@seed.ttrpg.local',
    username: 'seed_player_anna',
    role: 'USER',
    displayName: 'Anna Cleric',
    bio: 'Фанатка підтримуючих персонажів',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    emailVerified: true,
    walletBalance: 120,
    stats: { hoursPlayed: 37, sessionsPlayed: 15 },
  },
  {
    key: 'player3',
    email: 'player.dmytro@seed.ttrpg.local',
    username: 'seed_player_dmytro',
    role: 'USER',
    displayName: 'Dmytro Ranger',
    bio: 'Відкритий до експериментів із системами',
    timezone: 'Europe/Prague',
    language: 'en',
    emailVerified: true,
    walletBalance: 140,
    stats: { hoursPlayed: 29, sessionsPlayed: 11 },
  },
  {
    key: 'player4',
    email: 'player.olha@seed.ttrpg.local',
    username: 'seed_player_olha',
    role: 'USER',
    displayName: 'Olha Bard',
    bio: 'Обожнюю соціальні сцени і дипломатію',
    timezone: 'Europe/Berlin',
    language: 'uk',
    emailVerified: true,
    walletBalance: 110,
    stats: { hoursPlayed: 33, sessionsPlayed: 13 },
  },
  {
    key: 'player5',
    email: 'player.mykola@seed.ttrpg.local',
    username: 'seed_player_mykola',
    role: 'USER',
    displayName: 'Mykola Fighter',
    bio: 'Шукаю регулярні one-shot сесії',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    emailVerified: false,
    walletBalance: 75,
    stats: { hoursPlayed: 14, sessionsPlayed: 6 },
  },
  {
    key: 'player6',
    email: 'player.sofia@seed.ttrpg.local',
    username: 'seed_player_sofia',
    role: 'USER',
    displayName: 'Sofia Druid',
    bio: 'Надаю перевагу спокійному темпу та roleplay',
    timezone: 'Europe/Kyiv',
    language: 'uk',
    emailVerified: true,
    walletBalance: 95,
    stats: { hoursPlayed: 18, sessionsPlayed: 8 },
  },
  {
    key: 'player7',
    email: 'player.vlad@seed.ttrpg.local',
    username: 'seed_player_vlad',
    role: 'USER',
    displayName: 'Vlad Wizard',
    bio: 'Люблю тактичні бої та математику билдiв',
    timezone: 'Europe/Kyiv',
    language: 'en',
    emailVerified: true,
    walletBalance: 60,
    stats: { hoursPlayed: 22, sessionsPlayed: 9 },
  },
  {
    key: 'player8',
    email: 'player.kate@seed.ttrpg.local',
    username: 'seed_player_kate',
    role: 'USER',
    displayName: 'Kate Monk',
    bio: 'Цікавлять короткі кампанії на 4-6 сесій',
    timezone: 'Europe/London',
    language: 'en',
    emailVerified: true,
    walletBalance: 85,
    stats: { hoursPlayed: 16, sessionsPlayed: 7 },
  },
];

function daysFromNow(days, hours = 19) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hours, 0, 0, 0);
  return date;
}

function hoursFromNow(hoursOffset) {
  const date = new Date();
  date.setTime(date.getTime() + hoursOffset * 60 * 60 * 1000);
  date.setUTCMinutes(0, 0, 0);
  return date;
}

async function cleanupPreviousSeedData() {
  const seededCampaigns = await prisma.campaign.findMany({
    where: { title: { startsWith: SEED_PREFIX } },
    select: { id: true },
  });

  const seededCampaignIds = seededCampaigns.map((c) => c.id);

  const seededSessions = await prisma.session.findMany({
    where: {
      OR: [
        { title: { startsWith: SEED_PREFIX } },
        seededCampaignIds.length > 0 ? { campaignId: { in: seededCampaignIds } } : { id: -1 },
      ],
    },
    select: { id: true },
  });

  const seededSessionIds = seededSessions.map((s) => s.id);

  if (seededSessionIds.length > 0) {
    await prisma.chatMessage.deleteMany({
      where: { sessionId: { in: seededSessionIds } },
    });

    await prisma.sessionParticipant.deleteMany({
      where: { sessionId: { in: seededSessionIds } },
    });

    await prisma.session.deleteMany({
      where: { id: { in: seededSessionIds } },
    });
  }

  if (seededCampaignIds.length > 0) {
    await prisma.joinRequest.deleteMany({
      where: { campaignId: { in: seededCampaignIds } },
    });

    await prisma.campaignMember.deleteMany({
      where: { campaignId: { in: seededCampaignIds } },
    });

    await prisma.campaign.deleteMany({
      where: { id: { in: seededCampaignIds } },
    });
  }
}

async function upsertUsersAndProfiles(passwordHash) {
  const usersByKey = {};

  for (const seedUser of usersSeed) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        username: seedUser.username,
        password: passwordHash,
        role: seedUser.role,
        displayName: seedUser.displayName,
        bio: seedUser.bio,
        timezone: seedUser.timezone,
        language: seedUser.language,
        emailVerified: seedUser.emailVerified,
        lastActiveAt: new Date(),
      },
      create: {
        email: seedUser.email,
        username: seedUser.username,
        password: passwordHash,
        role: seedUser.role,
        displayName: seedUser.displayName,
        bio: seedUser.bio,
        timezone: seedUser.timezone,
        language: seedUser.language,
        emailVerified: seedUser.emailVerified,
        lastActiveAt: new Date(),
      },
    });

    await prisma.wallet.upsert({
      where: { userId: user.id },
      update: { balance: seedUser.walletBalance },
      create: { userId: user.id, balance: seedUser.walletBalance },
    });

    await prisma.userStats.upsert({
      where: { userId: user.id },
      update: {
        hoursPlayed: seedUser.stats.hoursPlayed,
        sessionsPlayed: seedUser.stats.sessionsPlayed,
      },
      create: {
        userId: user.id,
        hoursPlayed: seedUser.stats.hoursPlayed,
        sessionsPlayed: seedUser.stats.sessionsPlayed,
      },
    });

    usersByKey[seedUser.key] = user;
  }

  return usersByKey;
}

async function createCampaigns(usersByKey) {
  const inviteCode1 = crypto.randomBytes(8).toString('hex');
  const inviteCode2 = crypto.randomBytes(8).toString('hex');

  const campaign1 = await prisma.campaign.create({
    data: {
      title: `${SEED_PREFIX} Curse of the Emerald Crown`,
      description: 'Класична фентезі кампанія для досвідчених гравців.',
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      ownerId: usersByKey.gm1.id,
    },
  });

  const campaign2 = await prisma.campaign.create({
    data: {
      title: `${SEED_PREFIX} Shadows over Kyiv`,
      description: 'Містичний детектив у сучасному сетингу.',
      system: 'Call of Cthulhu',
      visibility: 'LINK_ONLY',
      inviteCode: inviteCode1,
      ownerId: usersByKey.gm2.id,
    },
  });

  const campaign3 = await prisma.campaign.create({
    data: {
      title: `${SEED_PREFIX} Iron Frontier`,
      description: 'Sci-fi кампанія з акцентом на тактику.',
      system: 'Pathfinder 2e',
      visibility: 'PRIVATE',
      inviteCode: inviteCode2,
      ownerId: usersByKey.gm1.id,
    },
  });

  const playerKeys = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'player7', 'player8'];
  const extraCampaignTemplates = [
    {
      title: 'Ashen Isles',
      description: 'Морська кампанія з дослідженням архіпелагу.',
      system: 'D&D 5e',
      visibility: 'PUBLIC',
      ownerKey: 'gm1',
    },
    {
      title: 'Neon District Files',
      description: 'Кіберпанк розслідування в мегаполісі.',
      system: 'Cyberpunk RED',
      visibility: 'LINK_ONLY',
      ownerKey: 'gm2',
    },
    {
      title: 'Winter Court',
      description: 'Політичні інтриги у фентезі-дворі.',
      system: 'Pathfinder 2e',
      visibility: 'PRIVATE',
      ownerKey: 'gm1',
    },
    {
      title: 'Blackwood Chronicle',
      description: 'Темний ліс, старі таємниці, виживання.',
      system: 'Shadowdark',
      visibility: 'PUBLIC',
      ownerKey: 'gm2',
    },
    {
      title: 'Clockwork Rebellion',
      description: 'Стімпанк повстання та саботаж.',
      system: 'Blades in the Dark',
      visibility: 'LINK_ONLY',
      ownerKey: 'gm1',
    },
    {
      title: 'Crimson Harbor',
      description: 'Контрабанда, змови і морські рейди.',
      system: '7th Sea',
      visibility: 'PUBLIC',
      ownerKey: 'gm2',
    },
    {
      title: 'Echo Protocol',
      description: 'Sci-fi трилер про аномалії на станції.',
      system: 'Starfinder',
      visibility: 'PRIVATE',
      ownerKey: 'gm1',
    },
  ];

  const extraCampaigns = [];
  const extraMembers = [];
  const extraJoinRequests = [];

  for (let index = 0; index < extraCampaignTemplates.length; index += 1) {
    const template = extraCampaignTemplates[index];
    const owner = usersByKey[template.ownerKey];

    const campaign = await prisma.campaign.create({
      data: {
        title: `${SEED_PREFIX} ${template.title}`,
        description: template.description,
        system: template.system,
        visibility: template.visibility,
        inviteCode: template.visibility === 'LINK_ONLY' ? crypto.randomBytes(8).toString('hex') : null,
        ownerId: owner.id,
      },
    });

    extraCampaigns.push(campaign);
    extraMembers.push({ campaignId: campaign.id, userId: owner.id, role: 'OWNER' });

    const playerA = usersByKey[playerKeys[index % playerKeys.length]];
    const playerB = usersByKey[playerKeys[(index + 2) % playerKeys.length]];
    const playerC = usersByKey[playerKeys[(index + 4) % playerKeys.length]];
    const supportGm = usersByKey[template.ownerKey === 'gm1' ? 'gm2' : 'gm1'];

    extraMembers.push(
      { campaignId: campaign.id, userId: supportGm.id, role: 'GM' },
      { campaignId: campaign.id, userId: playerA.id, role: 'PLAYER' },
      { campaignId: campaign.id, userId: playerB.id, role: 'PLAYER' },
      { campaignId: campaign.id, userId: playerC.id, role: 'PLAYER' }
    );

    if (index % 2 === 0) {
      const requester = usersByKey[playerKeys[(index + 1) % playerKeys.length]];
      extraJoinRequests.push({
        userId: requester.id,
        campaignId: campaign.id,
        status: index % 4 === 0 ? 'PENDING' : 'APPROVED',
        message: 'Хочу приєднатися до цієї кампанії для регулярної гри.',
        reviewedBy: index % 4 === 0 ? null : owner.id,
        reviewedAt: index % 4 === 0 ? null : new Date(),
      });
    }
  }

  await prisma.campaignMember.createMany({
    data: [
      { campaignId: campaign1.id, userId: usersByKey.gm1.id, role: 'OWNER' },
      { campaignId: campaign1.id, userId: usersByKey.player1.id, role: 'PLAYER' },
      { campaignId: campaign1.id, userId: usersByKey.player2.id, role: 'PLAYER' },
      { campaignId: campaign1.id, userId: usersByKey.player3.id, role: 'PLAYER' },
      { campaignId: campaign1.id, userId: usersByKey.player4.id, role: 'PLAYER' },

      { campaignId: campaign2.id, userId: usersByKey.gm2.id, role: 'OWNER' },
      { campaignId: campaign2.id, userId: usersByKey.player5.id, role: 'PLAYER' },
      { campaignId: campaign2.id, userId: usersByKey.player6.id, role: 'PLAYER' },

      { campaignId: campaign3.id, userId: usersByKey.gm1.id, role: 'OWNER' },
      { campaignId: campaign3.id, userId: usersByKey.gm2.id, role: 'GM' },
      { campaignId: campaign3.id, userId: usersByKey.player7.id, role: 'PLAYER' },
      { campaignId: campaign3.id, userId: usersByKey.player8.id, role: 'PLAYER' },
      ...extraMembers,
    ],
  });

  await prisma.joinRequest.createMany({
    data: [
      {
        userId: usersByKey.player6.id,
        campaignId: campaign1.id,
        status: 'PENDING',
        message: 'Хочу приєднатися як саппорт-персонаж.',
      },
      {
        userId: usersByKey.player5.id,
        campaignId: campaign1.id,
        status: 'REJECTED',
        message: 'Маю досвід у D&D, можу грати щотижня.',
        reviewedBy: usersByKey.gm1.id,
        reviewedAt: new Date(),
      },
      {
        userId: usersByKey.player1.id,
        campaignId: campaign2.id,
        status: 'APPROVED',
        message: 'Цікавий до горор-сетингів.',
        reviewedBy: usersByKey.gm2.id,
        reviewedAt: new Date(),
      },
      ...extraJoinRequests,
    ],
  });

  return {
    campaign1,
    campaign2,
    campaign3,
    allCampaigns: [campaign1, campaign2, campaign3, ...extraCampaigns],
  };
}

async function createSessions(usersByKey, campaigns) {
  const playerKeys = ['player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'player7', 'player8'];
  const allCampaigns = campaigns.allCampaigns || [campaigns.campaign1, campaigns.campaign2, campaigns.campaign3];

  const session1 = await prisma.session.create({
    data: {
      title: `${SEED_PREFIX} Emerald Crown #1`,
      description: 'Знайомство з партією та вступний квест.',
      date: daysFromNow(2, 18),
      duration: 180,
      status: 'PLANNED',
      visibility: 'PUBLIC',
      price: 120,
      maxPlayers: 5,
      system: 'D&D 5e',
      campaignId: campaigns.campaign1.id,
      creatorId: usersByKey.gm1.id,
    },
  });

  const session2 = await prisma.session.create({
    data: {
      title: `${SEED_PREFIX} Shadows #2`,
      description: 'Розслідування зникнень у старому районі.',
      date: hoursFromNow(-1),
      duration: 210,
      status: 'ACTIVE',
      visibility: 'LINK_ONLY',
      price: 150,
      maxPlayers: 4,
      system: 'Call of Cthulhu',
      campaignId: campaigns.campaign2.id,
      creatorId: usersByKey.gm2.id,
    },
  });

  const session3 = await prisma.session.create({
    data: {
      title: `${SEED_PREFIX} Iron Frontier #0`,
      description: 'Прекампанійний one-shot для команди.',
      date: daysFromNow(-7, 17),
      duration: 150,
      status: 'FINISHED',
      visibility: 'PRIVATE',
      price: 100,
      maxPlayers: 5,
      system: 'Pathfinder 2e',
      campaignId: campaigns.campaign3.id,
      creatorId: usersByKey.gm1.id,
    },
  });

  const session4 = await prisma.session.create({
    data: {
      title: `${SEED_PREFIX} Saturday One-Shot`,
      description: 'Окрема тестова сесія без кампанії.',
      date: daysFromNow(3, 16),
      duration: 120,
      status: 'PLANNED',
      visibility: 'PUBLIC',
      price: 80,
      maxPlayers: 6,
      system: 'Dungeon World',
      campaignId: null,
      creatorId: usersByKey.gm2.id,
    },
  });

  const session5 = await prisma.session.create({
    data: {
      title: `${SEED_PREFIX} Zombie Active (Auto-Finish Test)`,
      description: 'Сесія для тестування soft auto-finish (ACTIVE, що давно мала завершитися).',
      date: hoursFromNow(-8),
      duration: 120,
      status: 'ACTIVE',
      visibility: 'PRIVATE',
      price: 0,
      maxPlayers: 4,
      system: 'D&D 5e',
      campaignId: campaigns.campaign1.id,
      creatorId: usersByKey.gm1.id,
    },
  });

  const session6 = await prisma.session.create({
    data: {
      title: `${SEED_PREFIX} Stale Planned (Auto-Cancel Test)`,
      description: 'Сесія для тестування авто-скасування PLANNED після 30+ днів.',
      date: daysFromNow(-40, 18),
      duration: 180,
      status: 'PLANNED',
      visibility: 'PRIVATE',
      price: 0,
      maxPlayers: 5,
      system: 'Pathfinder 2e',
      campaignId: campaigns.campaign3.id,
      creatorId: usersByKey.gm2.id,
    },
  });

  const extraSessions = [];
  const statusCycle = ['PLANNED', 'FINISHED', 'CANCELED'];
  const visibilityCycle = ['PUBLIC', 'PRIVATE', 'LINK_ONLY'];

  for (let index = 0; index < 13; index += 1) {
    const linkedCampaign = index % 4 === 0 ? null : allCampaigns[index % allCampaigns.length];
    const gmKey = index % 2 === 0 ? 'gm1' : 'gm2';
    const gmUser = usersByKey[gmKey];

    const status = statusCycle[index % statusCycle.length];
    const sessionDate = status === 'PLANNED'
      ? daysFromNow(6 + index, 14 + (index % 6))
      : daysFromNow(-(3 + index), 14 + (index % 6));

    const session = await prisma.session.create({
      data: {
        title: `${SEED_PREFIX} Extra Session #${index + 1}`,
        description: `Додаткова тестова сесія #${index + 1} для перевірки списків і фільтрів.`,
        date: sessionDate,
        duration: 120 + (index % 4) * 30,
        status,
        visibility: visibilityCycle[index % visibilityCycle.length],
        price: 60 + index * 5,
        maxPlayers: 4 + (index % 3),
        system: linkedCampaign?.system || (index % 2 === 0 ? 'D&D 5e' : 'Pathfinder 2e'),
        campaignId: linkedCampaign?.id || null,
        creatorId: gmUser.id,
      },
    });

    extraSessions.push(session);
  }

  await prisma.sessionParticipant.createMany({
    data: [
      { sessionId: session1.id, userId: usersByKey.gm1.id, role: 'GM', status: 'CONFIRMED' },
      { sessionId: session1.id, userId: usersByKey.player1.id, role: 'PLAYER', status: 'CONFIRMED' },
      { sessionId: session1.id, userId: usersByKey.player2.id, role: 'PLAYER', status: 'PENDING' },
      { sessionId: session1.id, userId: usersByKey.player3.id, role: 'PLAYER', status: 'DECLINED' },

      { sessionId: session2.id, userId: usersByKey.gm2.id, role: 'GM', status: 'CONFIRMED' },
      { sessionId: session2.id, userId: usersByKey.player5.id, role: 'PLAYER', status: 'CONFIRMED' },
      { sessionId: session2.id, userId: usersByKey.player6.id, role: 'PLAYER', status: 'CONFIRMED' },

      { sessionId: session3.id, userId: usersByKey.gm1.id, role: 'GM', status: 'ATTENDED' },
      { sessionId: session3.id, userId: usersByKey.gm2.id, role: 'PLAYER', status: 'ATTENDED' },
      { sessionId: session3.id, userId: usersByKey.player7.id, role: 'PLAYER', status: 'NO_SHOW' },
      { sessionId: session3.id, userId: usersByKey.player8.id, role: 'PLAYER', status: 'ATTENDED' },

      { sessionId: session4.id, userId: usersByKey.gm2.id, role: 'GM', status: 'CONFIRMED' },
      { sessionId: session4.id, userId: usersByKey.player4.id, role: 'PLAYER', status: 'PENDING' },
      { sessionId: session4.id, userId: usersByKey.player1.id, role: 'PLAYER', status: 'CONFIRMED' },

      { sessionId: session5.id, userId: usersByKey.gm1.id, role: 'GM', status: 'CONFIRMED' },
      { sessionId: session5.id, userId: usersByKey.player2.id, role: 'PLAYER', status: 'CONFIRMED' },
      { sessionId: session5.id, userId: usersByKey.player3.id, role: 'PLAYER', status: 'CONFIRMED' },

      { sessionId: session6.id, userId: usersByKey.gm2.id, role: 'GM', status: 'CONFIRMED' },
      { sessionId: session6.id, userId: usersByKey.player7.id, role: 'PLAYER', status: 'PENDING' },
      { sessionId: session6.id, userId: usersByKey.player8.id, role: 'PLAYER', status: 'CONFIRMED' },
      ...extraSessions.flatMap((session, index) => {
        const gmKey = index % 2 === 0 ? 'gm1' : 'gm2';
        const firstPlayer = usersByKey[playerKeys[index % playerKeys.length]];
        const secondPlayer = usersByKey[playerKeys[(index + 3) % playerKeys.length]];
        const thirdPlayer = usersByKey[playerKeys[(index + 5) % playerKeys.length]];

        return [
          { sessionId: session.id, userId: usersByKey[gmKey].id, role: 'GM', status: 'CONFIRMED' },
          { sessionId: session.id, userId: firstPlayer.id, role: 'PLAYER', status: 'CONFIRMED' },
          { sessionId: session.id, userId: secondPlayer.id, role: 'PLAYER', status: index % 3 === 0 ? 'PENDING' : 'CONFIRMED' },
          { sessionId: session.id, userId: thirdPlayer.id, role: 'PLAYER', status: index % 5 === 0 ? 'DECLINED' : 'CONFIRMED' },
        ];
      }),
    ],
  });

  await prisma.chatMessage.createMany({
    data: [
      { sessionId: session1.id, userId: usersByKey.gm1.id, text: 'Всім привіт! Підготуйте персонажів до 3 рівня.' },
      { sessionId: session1.id, userId: usersByKey.player1.id, text: 'Ок, беру rogue з фокусом на stealth.' },
      { sessionId: session2.id, userId: usersByKey.gm2.id, text: 'Не забудьте про safety tools перед стартом.' },
      { sessionId: session3.id, userId: usersByKey.player8.id, text: 'Фінальна сцена була топ, дякую!' },
      { sessionId: session4.id, userId: usersByKey.player4.id, text: 'Можу трохи запізнитись на 10 хв.' },
      { sessionId: session5.id, userId: usersByKey.gm1.id, text: 'Тестова ACTIVE сесія для перевірки soft auto-finish.' },
      { sessionId: session6.id, userId: usersByKey.gm2.id, text: 'Тестова PLANNED сесія для перевірки auto-cancel > 30 днів.' },
      ...extraSessions.map((session, index) => {
        const authorKey = index % 2 === 0 ? 'player2' : 'player7';
        return {
          sessionId: session.id,
          userId: usersByKey[authorKey].id,
          text: `Підтверджую участь у додатковій сесії #${index + 1}.`,
        };
      }),
    ],
  });
}

async function createTransactions(usersByKey) {
  const wallets = await prisma.wallet.findMany({
    where: {
      userId: {
        in: [
          usersByKey.player1.id,
          usersByKey.player2.id,
          usersByKey.player5.id,
          usersByKey.gm1.id,
        ],
      },
    },
    select: { id: true, userId: true },
  });

  const walletByUserId = Object.fromEntries(wallets.map((w) => [w.userId, w.id]));

  await prisma.transaction.createMany({
    data: [
      {
        walletId: walletByUserId[usersByKey.player1.id],
        amount: 300,
        type: 'DEPOSIT',
        date: daysFromNow(-20, 12),
      },
      {
        walletId: walletByUserId[usersByKey.player1.id],
        amount: -120,
        type: 'PAYMENT',
        date: daysFromNow(-1, 12),
      },
      {
        walletId: walletByUserId[usersByKey.player2.id],
        amount: 250,
        type: 'DEPOSIT',
        date: daysFromNow(-18, 12),
      },
      {
        walletId: walletByUserId[usersByKey.player5.id],
        amount: 180,
        type: 'DEPOSIT',
        date: daysFromNow(-10, 12),
      },
      {
        walletId: walletByUserId[usersByKey.gm1.id],
        amount: 120,
        type: 'PAYMENT',
        date: daysFromNow(-1, 13),
      },
    ],
  });
}

async function main() {
  console.log('🌱 Запуск сидингу...');
  console.log(`🔐 Тестовий пароль для всіх seed-користувачів: ${TEST_PASSWORD}`);

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  await cleanupPreviousSeedData();

  const usersByKey = await upsertUsersAndProfiles(passwordHash);
  const campaigns = await createCampaigns(usersByKey);
  await createSessions(usersByKey, campaigns);
  await createTransactions(usersByKey);

  console.log('✅ Сидинг завершено успішно.');
  console.log('📌 Створено: користувачі, кампанії, сесії, учасники, заявки, чат і транзакції.');
}

main()
  .catch((error) => {
    console.error('❌ Помилка сидингу:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
