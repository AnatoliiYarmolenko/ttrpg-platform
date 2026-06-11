-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "balance" TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "amount" TYPE DECIMAL(65,30),
ADD COLUMN "sessionId" INTEGER;

-- AlterTable
ALTER TABLE "Session" ALTER COLUMN "price" TYPE DECIMAL(65,30),
ADD COLUMN "platformFeePercent" DECIMAL(65,30) NOT NULL DEFAULT 0.0,
ADD COLUMN "heldAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.0;

-- Add check constraint to Wallet balance to prevent negative balances
ALTER TABLE "Wallet" ADD CONSTRAINT wallet_balance_non_negative CHECK (balance >= 0.0);
