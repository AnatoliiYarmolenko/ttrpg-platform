ALTER TABLE "Campaign"
ADD COLUMN "shareTokenEncrypted" TEXT;

ALTER TABLE "Session"
ADD COLUMN "shareTokenEncrypted" TEXT;

UPDATE "Session"
SET "visibility" = 'PRIVATE',
    "shareTokenHash" = NULL,
    "shareTokenEncrypted" = NULL,
    "shareTokenCreatedAt" = NULL
WHERE "campaignId" IS NOT NULL
  AND "visibility" = 'LINK_ONLY';
