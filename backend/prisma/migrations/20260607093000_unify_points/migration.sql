BEGIN;

-- CreateEnum
CREATE TYPE "PointLedgerType" AS ENUM ('redeem_code', 'ad_reward', 'recharge', 'manual_adjustment', 'model_usage', 'refund');

-- Rename point-facing columns. Old token grants are intentionally not carried
-- into the new account balance; existing users receive a zero-point account.
ALTER TABLE "Plan" RENAME COLUMN "tokenAmount" TO "pointAmount";
ALTER TABLE "Plan" DROP COLUMN "validDays";
ALTER TABLE "RechargeOrder" RENAME COLUMN "tokens" TO "points";
ALTER TABLE "AdRewardConfig" RENAME COLUMN "rewardTokens" TO "rewardPoints";
ALTER TABLE "AdRewardConfig" DROP COLUMN "rewardTokenValidDays";
ALTER TABLE "AdRewardSession" RENAME COLUMN "rewardTokens" TO "rewardPoints";
ALTER TABLE "UsageEvent" RENAME COLUMN "sub2apiUsageId" TO "usageKey";
ALTER INDEX "UsageEvent_sub2apiUsageId_key" RENAME TO "UsageEvent_usageKey_key";

-- CreateTable
CREATE TABLE "PointAccount" (
    "userId" TEXT NOT NULL,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PointLedgerType" NOT NULL,
    "deltaPoints" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "relatedId" TEXT,
    "remark" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointLedger_userId_createdAt_idx" ON "PointLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLedger_relatedId_idx" ON "PointLedger"("relatedId");

-- AddForeignKey
ALTER TABLE "PointAccount" ADD CONSTRAINT "PointAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing balances are reset to zero by design.
INSERT INTO "PointAccount" ("userId", "balance", "updatedAt", "createdAt")
SELECT "id", 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "User"
ON CONFLICT ("userId") DO NOTHING;

-- Remove deprecated token/quota accounting and Sub2API usage sync state.
DROP TABLE "QuotaLedger";
DROP TABLE "TokenGrant";
DROP TABLE "SyncState";
DROP TYPE "QuotaLedgerType";
DROP TYPE "TokenGrantStatus";
DROP TYPE "TokenGrantSource";

COMMIT;
