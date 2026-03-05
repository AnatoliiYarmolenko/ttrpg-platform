-- Rename session ownership column from creatorId to ownerId
ALTER TABLE "Session"
RENAME COLUMN "creatorId" TO "ownerId";

-- Keep foreign key naming consistent with the new column name
ALTER TABLE "Session"
RENAME CONSTRAINT "Session_creatorId_fkey" TO "Session_ownerId_fkey";
