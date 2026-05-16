/*
  Warnings:

  - You are about to drop the column `sessionId` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `text` on the `ChatMessage` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ChatMessage` table. All the data in the column will be lost.
  - Added the required column `chatId` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `content` to the `ChatMessage` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('USER', 'SYSTEM');

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_userId_fkey";

-- AlterTable
ALTER TABLE "ChatMessage" DROP COLUMN "sessionId",
DROP COLUMN "text",
DROP COLUMN "userId",
ADD COLUMN     "authorId" INTEGER,
ADD COLUMN     "chatId" INTEGER NOT NULL,
ADD COLUMN     "content" TEXT NOT NULL,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" "ChatMessageType" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "Chat" (
    "id" SERIAL NOT NULL,
    "campaignId" INTEGER,
    "sessionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chat_campaignId_key" ON "Chat"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_sessionId_key" ON "Chat"("sessionId");

-- CreateIndex
CREATE INDEX "Chat_campaignId_idx" ON "Chat"("campaignId");

-- CreateIndex
CREATE INDEX "Chat_sessionId_idx" ON "Chat"("sessionId");

-- CreateIndex
CREATE INDEX "ChatMessage_chatId_createdAt_id_idx" ON "ChatMessage"("chatId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure each chat belongs to exactly one scope (campaign or session)
ALTER TABLE "Chat"
ADD CONSTRAINT "Chat_scope_check"
CHECK (
  ("campaignId" IS NOT NULL AND "sessionId" IS NULL)
  OR
  ("campaignId" IS NULL AND "sessionId" IS NOT NULL)
);
