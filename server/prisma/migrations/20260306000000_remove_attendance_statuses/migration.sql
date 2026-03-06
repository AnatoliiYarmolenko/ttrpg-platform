-- Remove attendance-specific participant statuses.
-- Map historical values before narrowing enum type.
ALTER TABLE "SessionParticipant" ALTER COLUMN "status" DROP DEFAULT;

UPDATE "SessionParticipant"
SET "status" = 'CONFIRMED'
WHERE "status" = 'ATTENDED';

UPDATE "SessionParticipant"
SET "status" = 'DECLINED'
WHERE "status" = 'NO_SHOW';

CREATE TYPE "ParticipantStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED');

ALTER TABLE "SessionParticipant"
ALTER COLUMN "status" TYPE "ParticipantStatus_new"
USING ("status"::text::"ParticipantStatus_new");

DROP TYPE "ParticipantStatus";
ALTER TYPE "ParticipantStatus_new" RENAME TO "ParticipantStatus";

ALTER TABLE "SessionParticipant"
ALTER COLUMN "status" SET DEFAULT 'PENDING';
