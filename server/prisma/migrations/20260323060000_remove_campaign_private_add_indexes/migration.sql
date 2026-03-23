-- 1) Split visibility enum usage: keep PRIVATE for sessions, remove it for campaigns.
CREATE TYPE "SessionVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'LINK_ONLY');

ALTER TABLE "Session"
ALTER COLUMN "visibility" DROP DEFAULT;

ALTER TABLE "Session"
ALTER COLUMN "visibility" TYPE "SessionVisibility"
USING ("visibility"::text::"SessionVisibility");

ALTER TABLE "Session"
ALTER COLUMN "visibility" SET DEFAULT 'PRIVATE';

-- 2) Migrate legacy campaign visibility values before narrowing enum.
ALTER TABLE "Campaign"
ALTER COLUMN "visibility" DROP DEFAULT;

UPDATE "Campaign"
SET "visibility" = 'LINK_ONLY'
WHERE "visibility" = 'PRIVATE';

ALTER TYPE "CampaignVisibility" RENAME TO "CampaignVisibility_old";

CREATE TYPE "CampaignVisibility" AS ENUM ('PUBLIC', 'LINK_ONLY');

ALTER TABLE "Campaign"
ALTER COLUMN "visibility" TYPE "CampaignVisibility"
USING ("visibility"::text::"CampaignVisibility");

ALTER TABLE "Campaign"
ALTER COLUMN "visibility" SET DEFAULT 'LINK_ONLY';

DROP TYPE "CampaignVisibility_old";

-- 3) Add performance indexes for frequent filters/joins.
CREATE INDEX "Session_status_idx" ON "Session"("status");
CREATE INDEX "Session_campaignId_idx" ON "Session"("campaignId");
CREATE INDEX "CampaignMember_campaignId_idx" ON "CampaignMember"("campaignId");
CREATE INDEX "JoinRequest_campaignId_status_idx" ON "JoinRequest"("campaignId", "status");
