-- Add notifications domain tables and enums
-- MVP-02: Notification domain schema

-- Create enums
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR', 'CRITICAL', 'SECURITY');
CREATE TYPE "RecipientStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- Add telegram fields to User
ALTER TABLE "User" ADD COLUMN "telegramChatId" TEXT;
ALTER TABLE "User" ADD COLUMN "telegramLinkedAt" TIMESTAMP(3);

-- Create Notification table
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "NotificationSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "metadata" JSONB,
    "dedupeKey" TEXT,
    "aggregationKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Create indexes for Notification
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Notification_eventKey_idx" ON "Notification"("eventKey");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_dedupeKey_idx" ON "Notification"("dedupeKey");
CREATE INDEX "Notification_aggregationKey_idx" ON "Notification"("aggregationKey");

-- Create NotificationRecipient table
CREATE TABLE "NotificationRecipient" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "RecipientStatus" NOT NULL DEFAULT 'UNREAD',
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "channelsDelivered" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes for NotificationRecipient
CREATE UNIQUE INDEX "NotificationRecipient_notificationId_userId_key" ON "NotificationRecipient"("notificationId", "userId");
CREATE INDEX "NotificationRecipient_userId_status_idx" ON "NotificationRecipient"("userId", "status");
CREATE INDEX "NotificationRecipient_userId_createdAt_idx" ON "NotificationRecipient"("userId", "createdAt");

-- Add foreign keys for NotificationRecipient
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" 
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create NotificationPreference table
CREATE TABLE "NotificationPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "enabledChannels" JSONB NOT NULL,
    "mutedCategories" JSONB,
    "mutedSeverities" JSONB,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- Create unique index for NotificationPreference
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- Add foreign key for NotificationPreference
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create OutboxEvent table
CREATE TABLE "OutboxEvent" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- Create index for OutboxEvent
CREATE INDEX "OutboxEvent_status_nextRunAt_idx" ON "OutboxEvent"("status", "nextRunAt");

-- Add foreign key for OutboxEvent
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_notificationId_fkey" 
    FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create DeliveryAttempt table
CREATE TABLE "DeliveryAttempt" (
    "id" SERIAL NOT NULL,
    "outboxId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- Create index for DeliveryAttempt
CREATE INDEX "DeliveryAttempt_outboxId_channel_idx" ON "DeliveryAttempt"("outboxId", "channel");

-- Add foreign key for DeliveryAttempt
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_outboxId_fkey" 
    FOREIGN KEY ("outboxId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
