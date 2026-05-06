ALTER TABLE "NotificationRecipient"
  ALTER COLUMN "archivedAt" SET DEFAULT NULL;

UPDATE "NotificationRecipient"
SET "archivedAt" = COALESCE("archivedAt", "readAt", NOW())
WHERE "status"::text IN ('READ', 'ARCHIVED');

ALTER TYPE "RecipientStatus" RENAME TO "RecipientStatus_old";

CREATE TYPE "RecipientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "NotificationRecipient"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "NotificationRecipient"
  ALTER COLUMN "status" TYPE "RecipientStatus"
  USING (
    CASE
      WHEN "status"::text = 'UNREAD' THEN 'ACTIVE'::"RecipientStatus"
      ELSE 'ARCHIVED'::"RecipientStatus"
    END
  );

ALTER TABLE "NotificationRecipient"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

DROP TYPE "RecipientStatus_old";
