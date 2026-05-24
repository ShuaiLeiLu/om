-- CreateEnum
CREATE TYPE "RechargeOrderStatus" AS ENUM ('pending', 'paid', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "RechargePaymentMethod" AS ENUM ('wechat', 'alipay', 'apple');

-- AlterEnum
ALTER TYPE "QuotaLedgerType" ADD VALUE IF NOT EXISTS 'recharge';

-- CreateTable
CREATE TABLE "RechargeOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokens" BIGINT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "paymentMethod" "RechargePaymentMethod" NOT NULL,
    "status" "RechargeOrderStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RechargeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RechargeOrder_orderNo_key" ON "RechargeOrder"("orderNo");

-- CreateIndex
CREATE INDEX "RechargeOrder_userId_createdAt_idx" ON "RechargeOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RechargeOrder_status_createdAt_idx" ON "RechargeOrder"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "RechargeOrder" ADD CONSTRAINT "RechargeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
