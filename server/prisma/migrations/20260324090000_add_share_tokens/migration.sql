ALTER TABLE "Campaign"
ADD COLUMN "shareTokenHash" TEXT,
ADD COLUMN "shareTokenCreatedAt" TIMESTAMP(3);

ALTER TABLE "Session"
ADD COLUMN "shareTokenHash" TEXT,
ADD COLUMN "shareTokenCreatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Campaign_shareTokenHash_key" ON "Campaign"("shareTokenHash");
CREATE UNIQUE INDEX "Session_shareTokenHash_key" ON "Session"("shareTokenHash");
