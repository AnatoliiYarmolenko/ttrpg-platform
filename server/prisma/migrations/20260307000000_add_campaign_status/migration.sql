-- Create campaign status enum and add status column to Campaign.
CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'FINISHED');

ALTER TABLE "Campaign"
ADD COLUMN "status" "CampaignStatus" NOT NULL DEFAULT 'ACTIVE';
