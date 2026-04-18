-- Remove legacy campaign invite code field and its unique constraint.
ALTER TABLE "Campaign" DROP CONSTRAINT IF EXISTS "Campaign_inviteCode_key";
ALTER TABLE "Campaign" DROP COLUMN IF EXISTS "inviteCode";
