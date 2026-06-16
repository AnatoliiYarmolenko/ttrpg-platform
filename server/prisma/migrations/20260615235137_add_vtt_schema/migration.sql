-- CreateEnum
CREATE TYPE "VttLayerType" AS ENUM ('BACKGROUND', 'GRID', 'TOKEN', 'DRAWING', 'GENERIC');

-- CreateEnum
CREATE TYPE "VttGridType" AS ENUM ('SQUARE', 'HEXAGONAL');

-- CreateEnum
CREATE TYPE "VttTokenType" AS ENUM ('PLAYER', 'MONSTER', 'NPC', 'GENERIC');

-- CreateEnum
CREATE TYPE "VttItemType" AS ENUM ('IMAGE', 'DRAWING');

-- CreateEnum
CREATE TYPE "VttDiceVisibility" AS ENUM ('PUBLIC', 'GM_ONLY');

-- CreateEnum
CREATE TYPE "VttCreatureType" AS ENUM ('MONSTER', 'HUMAN');

-- CreateTable
CREATE TABLE "VttRoom" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "openedById" INTEGER,
    "activeSceneId" INTEGER,
    "lastSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VttRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttScene" (
    "id" SERIAL NOT NULL,
    "sceneKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'New Scene',
    "width" INTEGER NOT NULL DEFAULT 2048,
    "height" INTEGER NOT NULL DEFAULT 2048,
    "gridSize" INTEGER NOT NULL DEFAULT 64,
    "backgroundColor" INTEGER NOT NULL DEFAULT 10337421,
    "gridEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gridType" "VttGridType" NOT NULL DEFAULT 'SQUARE',
    "gridColor" INTEGER NOT NULL DEFAULT 10337421,
    "gridOpacity" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "gridScale" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roomId" INTEGER,
    "campaignId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VttScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttLayer" (
    "id" SERIAL NOT NULL,
    "layerKey" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Layer',
    "type" "VttLayerType" NOT NULL DEFAULT 'GENERIC',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "opacity" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sceneId" INTEGER NOT NULL,

    CONSTRAINT "VttLayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttLayerItem" (
    "id" SERIAL NOT NULL,
    "itemKey" TEXT NOT NULL,
    "type" "VttItemType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "scaleX" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scaleY" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" JSONB,
    "color" TEXT,
    "thickness" DOUBLE PRECISION,
    "drawTool" TEXT,
    "layerId" INTEGER NOT NULL,
    "authorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VttLayerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttToken" (
    "id" SERIAL NOT NULL,
    "tokenKey" TEXT NOT NULL,
    "type" "VttTokenType" NOT NULL DEFAULT 'GENERIC',
    "name" TEXT,
    "avatarUrl" TEXT,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "size" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "color" TEXT,
    "hpCurrent" INTEGER,
    "hpMax" INTEGER,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sceneId" INTEGER NOT NULL,
    "characterSheetId" INTEGER,
    "gmCreatureId" INTEGER,

    CONSTRAINT "VttToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttCharacterSheet" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" INTEGER,
    "campaignId" INTEGER,
    "name" TEXT NOT NULL DEFAULT 'Без імені',
    "level" INTEGER NOT NULL DEFAULT 1,
    "characterClass" TEXT,
    "race" TEXT,
    "avatarUrl" TEXT,
    "hpCurrent" INTEGER NOT NULL DEFAULT 10,
    "hpMax" INTEGER NOT NULL DEFAULT 10,
    "tempHp" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "initiativeBonus" INTEGER NOT NULL DEFAULT 0,
    "proficiencyBonus" INTEGER NOT NULL DEFAULT 2,
    "hitDiceCurrent" INTEGER NOT NULL DEFAULT 1,
    "hitDiceMax" INTEGER NOT NULL DEFAULT 1,
    "hitDiceType" TEXT NOT NULL DEFAULT 'd8',
    "tokenBorderColor" TEXT NOT NULL DEFAULT '#eab308',
    "stats" JSONB NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
    "savingThrows" JSONB NOT NULL DEFAULT '{"str":false,"dex":false,"con":false,"int":false,"wis":false,"cha":false}',
    "skills" JSONB NOT NULL DEFAULT '{"acrobatics":false,"animalHandling":false,"arcana":false,"athletics":false,"deception":false,"history":false,"insight":false,"intimidation":false,"investigation":false,"medicine":false,"nature":false,"perception":false,"performance":false,"persuasion":false,"religion":false,"sleightOfHand":false,"stealth":false,"survival":false}',
    "coins" JSONB NOT NULL DEFAULT '{"cp":0,"sp":0,"ep":0,"gp":0,"pp":0}',
    "attacks" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "features" TEXT,
    "backpack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VttCharacterSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttGmCreature" (
    "id" SERIAL NOT NULL,
    "gmUserId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "type" "VttCreatureType" NOT NULL DEFAULT 'MONSTER',
    "name" TEXT NOT NULL DEFAULT 'Новий ворог',
    "level" INTEGER NOT NULL DEFAULT 1,
    "characterClass" TEXT,
    "race" TEXT,
    "avatarUrl" TEXT,
    "hpCurrent" INTEGER NOT NULL DEFAULT 10,
    "hpMax" INTEGER NOT NULL DEFAULT 10,
    "tempHp" INTEGER NOT NULL DEFAULT 0,
    "ac" INTEGER NOT NULL DEFAULT 10,
    "speed" INTEGER NOT NULL DEFAULT 30,
    "initiativeBonus" INTEGER NOT NULL DEFAULT 0,
    "proficiencyBonus" INTEGER NOT NULL DEFAULT 2,
    "hitDiceCurrent" INTEGER NOT NULL DEFAULT 1,
    "hitDiceMax" INTEGER NOT NULL DEFAULT 1,
    "hitDiceType" TEXT NOT NULL DEFAULT 'd8',
    "tokenBorderColor" TEXT NOT NULL DEFAULT '#ef4444',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
    "savingThrows" JSONB NOT NULL DEFAULT '{"str":false,"dex":false,"con":false,"int":false,"wis":false,"cha":false}',
    "skills" JSONB NOT NULL DEFAULT '{"acrobatics":false,"animalHandling":false,"arcana":false,"athletics":false,"deception":false,"history":false,"insight":false,"intimidation":false,"investigation":false,"medicine":false,"nature":false,"perception":false,"performance":false,"persuasion":false,"religion":false,"sleightOfHand":false,"stealth":false,"survival":false}',
    "coins" JSONB NOT NULL DEFAULT '{"cp":0,"sp":0,"ep":0,"gp":0,"pp":0}',
    "attacks" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VttGmCreature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttDiceRoll" (
    "id" SERIAL NOT NULL,
    "rollKey" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "player" TEXT NOT NULL,
    "characterName" TEXT,
    "name" TEXT,
    "strength" INTEGER NOT NULL DEFAULT 1,
    "visibility" "VttDiceVisibility" NOT NULL DEFAULT 'PUBLIC',
    "roomId" INTEGER NOT NULL,
    "initiatorId" INTEGER,
    "rolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VttDiceRoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VttInitiativeEntry" (
    "id" SERIAL NOT NULL,
    "entryKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "roomId" INTEGER NOT NULL,

    CONSTRAINT "VttInitiativeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VttRoom_sessionId_key" ON "VttRoom"("sessionId");

-- CreateIndex
CREATE INDEX "VttRoom_sessionId_idx" ON "VttRoom"("sessionId");

-- CreateIndex
CREATE INDEX "VttScene_roomId_idx" ON "VttScene"("roomId");

-- CreateIndex
CREATE INDEX "VttScene_campaignId_idx" ON "VttScene"("campaignId");

-- CreateIndex
CREATE INDEX "VttLayer_sceneId_idx" ON "VttLayer"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "VttLayer_sceneId_layerKey_key" ON "VttLayer"("sceneId", "layerKey");

-- CreateIndex
CREATE INDEX "VttLayerItem_layerId_idx" ON "VttLayerItem"("layerId");

-- CreateIndex
CREATE UNIQUE INDEX "VttLayerItem_layerId_itemKey_key" ON "VttLayerItem"("layerId", "itemKey");

-- CreateIndex
CREATE INDEX "VttToken_sceneId_idx" ON "VttToken"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "VttToken_sceneId_tokenKey_key" ON "VttToken"("sceneId", "tokenKey");

-- CreateIndex
CREATE INDEX "VttCharacterSheet_sessionId_idx" ON "VttCharacterSheet"("sessionId");

-- CreateIndex
CREATE INDEX "VttCharacterSheet_campaignId_idx" ON "VttCharacterSheet"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "VttCharacterSheet_userId_sessionId_key" ON "VttCharacterSheet"("userId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "VttCharacterSheet_userId_campaignId_key" ON "VttCharacterSheet"("userId", "campaignId");

-- CreateIndex
CREATE INDEX "VttGmCreature_sessionId_gmUserId_idx" ON "VttGmCreature"("sessionId", "gmUserId");

-- CreateIndex
CREATE INDEX "VttDiceRoll_roomId_rolledAt_idx" ON "VttDiceRoll"("roomId", "rolledAt");

-- CreateIndex
CREATE INDEX "VttInitiativeEntry_roomId_idx" ON "VttInitiativeEntry"("roomId");

-- AddForeignKey
ALTER TABLE "VttRoom" ADD CONSTRAINT "VttRoom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttRoom" ADD CONSTRAINT "VttRoom_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttScene" ADD CONSTRAINT "VttScene_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VttRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttScene" ADD CONSTRAINT "VttScene_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttLayer" ADD CONSTRAINT "VttLayer_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "VttScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttLayerItem" ADD CONSTRAINT "VttLayerItem_layerId_fkey" FOREIGN KEY ("layerId") REFERENCES "VttLayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttLayerItem" ADD CONSTRAINT "VttLayerItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttToken" ADD CONSTRAINT "VttToken_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "VttScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttToken" ADD CONSTRAINT "VttToken_characterSheetId_fkey" FOREIGN KEY ("characterSheetId") REFERENCES "VttCharacterSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttToken" ADD CONSTRAINT "VttToken_gmCreatureId_fkey" FOREIGN KEY ("gmCreatureId") REFERENCES "VttGmCreature"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttCharacterSheet" ADD CONSTRAINT "VttCharacterSheet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttCharacterSheet" ADD CONSTRAINT "VttCharacterSheet_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttCharacterSheet" ADD CONSTRAINT "VttCharacterSheet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttGmCreature" ADD CONSTRAINT "VttGmCreature_gmUserId_fkey" FOREIGN KEY ("gmUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttGmCreature" ADD CONSTRAINT "VttGmCreature_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttDiceRoll" ADD CONSTRAINT "VttDiceRoll_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VttRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttDiceRoll" ADD CONSTRAINT "VttDiceRoll_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VttInitiativeEntry" ADD CONSTRAINT "VttInitiativeEntry_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "VttRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
