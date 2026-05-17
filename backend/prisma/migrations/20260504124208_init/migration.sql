-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('admin', 'owner');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "QrSessionMode" AS ENUM ('login');

-- CreateEnum
CREATE TYPE "QrSessionStatus" AS ENUM ('pending', 'scanned', 'confirmed', 'expired', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "RedeemCodeStatus" AS ENUM ('unused', 'used', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "TokenGrantSource" AS ENUM ('redeem_code', 'ad_reward', 'manual_adjustment');

-- CreateEnum
CREATE TYPE "TokenGrantStatus" AS ENUM ('active', 'exhausted', 'expired', 'revoked');

-- CreateEnum
CREATE TYPE "QuotaLedgerType" AS ENUM ('redeem_code', 'ad_reward', 'manual_adjustment', 'model_usage', 'grant_expired', 'refund');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'deleted');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('pending', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "LlmRequestStatus" AS ENUM ('pending', 'streaming', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "UsageEventStatus" AS ENUM ('matched', 'unmatched', 'charged', 'ignored');

-- CreateEnum
CREATE TYPE "RewardSessionStatus" AS ENUM ('pending', 'granted', 'expired', 'rejected');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'admin',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OauthAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "appid" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "nickname" TEXT NOT NULL DEFAULT '',
    "avatarUrl" TEXT NOT NULL DEFAULT '',
    "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OauthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WechatQrSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" "QrSessionMode" NOT NULL DEFAULT 'login',
    "scene" TEXT NOT NULL,
    "status" "QrSessionStatus" NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "openid" TEXT,
    "unionid" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scannedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WechatQrSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WechatMiniappSession" (
    "id" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "unionid" TEXT,
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "WechatMiniappSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenAmount" BIGINT NOT NULL,
    "validDays" INTEGER NOT NULL,
    "modelScope" JSONB,
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "remark" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedeemCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "RedeemCodeStatus" NOT NULL DEFAULT 'unused',
    "expiresAt" TIMESTAMP(3),
    "usedByUserId" TEXT,
    "usedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RedeemCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TokenGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "TokenGrantSource" NOT NULL,
    "sourceId" TEXT,
    "totalTokens" BIGINT NOT NULL,
    "remainingTokens" BIGINT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "TokenGrantStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantId" TEXT,
    "type" "QuotaLedgerType" NOT NULL,
    "deltaTokens" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "relatedId" TEXT,
    "remark" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotaLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '新对话',
    "defaultModelId" TEXT,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "imagesJson" JSONB,
    "modelId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "modelId" TEXT NOT NULL,
    "sub2apiRequestId" TEXT,
    "status" "LlmRequestStatus" NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageEvent" (
    "id" TEXT NOT NULL,
    "sub2apiUsageId" TEXT NOT NULL,
    "llmRequestId" TEXT,
    "userId" TEXT,
    "modelId" TEXT,
    "promptTokens" BIGINT NOT NULL DEFAULT 0,
    "completionTokens" BIGINT NOT NULL DEFAULT 0,
    "totalTokens" BIGINT NOT NULL DEFAULT 0,
    "cost" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "rawJson" JSONB NOT NULL,
    "status" "UsageEventStatus" NOT NULL DEFAULT 'unmatched',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sub2apiModel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "remark" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRewardConfig" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "adUnitId" TEXT NOT NULL DEFAULT '',
    "rewardTokens" BIGINT NOT NULL DEFAULT 10,
    "dailyLimitPerUser" INTEGER NOT NULL DEFAULT 5,
    "rewardTokenValidDays" INTEGER NOT NULL DEFAULT 7,
    "minIntervalSeconds" INTEGER NOT NULL DEFAULT 30,
    "sessionTtlSeconds" INTEGER NOT NULL DEFAULT 300,
    "updatedByAdminId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRewardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRewardSession" (
    "id" TEXT NOT NULL,
    "rewardSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openid" TEXT NOT NULL,
    "adUnitId" TEXT NOT NULL,
    "rewardTokens" BIGINT NOT NULL,
    "status" "RewardSessionStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRewardSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRewardEvent" (
    "id" TEXT NOT NULL,
    "rewardSessionId" TEXT,
    "userId" TEXT,
    "openid" TEXT,
    "eventType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorCode" TEXT,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRewardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cursor" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_refreshTokenHash_key" ON "AdminSession"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_idx" ON "AdminSession"("adminUserId");

-- CreateIndex
CREATE INDEX "OauthAccount_unionid_idx" ON "OauthAccount"("unionid");

-- CreateIndex
CREATE INDEX "OauthAccount_userId_idx" ON "OauthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OauthAccount_provider_appid_openid_key" ON "OauthAccount"("provider", "appid", "openid");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- CreateIndex
CREATE INDEX "UserSession_refreshTokenHash_idx" ON "UserSession"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "WechatQrSession_sessionId_key" ON "WechatQrSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "WechatQrSession_scene_key" ON "WechatQrSession"("scene");

-- CreateIndex
CREATE INDEX "WechatQrSession_scene_idx" ON "WechatQrSession"("scene");

-- CreateIndex
CREATE INDEX "WechatQrSession_status_idx" ON "WechatQrSession"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WechatMiniappSession_sessionTokenHash_key" ON "WechatMiniappSession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "WechatMiniappSession_openid_idx" ON "WechatMiniappSession"("openid");

-- CreateIndex
CREATE INDEX "WechatMiniappSession_userId_idx" ON "WechatMiniappSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RedeemCode_codeHash_key" ON "RedeemCode"("codeHash");

-- CreateIndex
CREATE INDEX "RedeemCode_planId_idx" ON "RedeemCode"("planId");

-- CreateIndex
CREATE INDEX "RedeemCode_status_idx" ON "RedeemCode"("status");

-- CreateIndex
CREATE INDEX "TokenGrant_userId_status_expiresAt_idx" ON "TokenGrant"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "QuotaLedger_userId_createdAt_idx" ON "QuotaLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "QuotaLedger_relatedId_idx" ON "QuotaLedger"("relatedId");

-- CreateIndex
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LlmRequest_requestId_key" ON "LlmRequest"("requestId");

-- CreateIndex
CREATE INDEX "LlmRequest_userId_createdAt_idx" ON "LlmRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LlmRequest_sub2apiRequestId_idx" ON "LlmRequest"("sub2apiRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageEvent_sub2apiUsageId_key" ON "UsageEvent"("sub2apiUsageId");

-- CreateIndex
CREATE INDEX "UsageEvent_userId_createdAt_idx" ON "UsageEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageEvent_llmRequestId_idx" ON "UsageEvent"("llmRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_sub2apiModel_key" ON "ModelConfig"("sub2apiModel");

-- CreateIndex
CREATE UNIQUE INDEX "AdRewardSession_rewardSessionId_key" ON "AdRewardSession"("rewardSessionId");

-- CreateIndex
CREATE INDEX "AdRewardSession_userId_createdAt_idx" ON "AdRewardSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdRewardSession_openid_createdAt_idx" ON "AdRewardSession"("openid", "createdAt");

-- CreateIndex
CREATE INDEX "AdRewardEvent_userId_createdAt_idx" ON "AdRewardEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AdRewardEvent_rewardSessionId_idx" ON "AdRewardEvent"("rewardSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_name_key" ON "SyncState"("name");

-- CreateIndex
CREATE INDEX "AdminAuditLog_adminUserId_createdAt_idx" ON "AdminAuditLog"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OauthAccount" ADD CONSTRAINT "OauthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WechatQrSession" ADD CONSTRAINT "WechatQrSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WechatMiniappSession" ADD CONSTRAINT "WechatMiniappSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedeemCode" ADD CONSTRAINT "RedeemCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TokenGrant" ADD CONSTRAINT "TokenGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaLedger" ADD CONSTRAINT "QuotaLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaLedger" ADD CONSTRAINT "QuotaLedger_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "TokenGrant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmRequest" ADD CONSTRAINT "LlmRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmRequest" ADD CONSTRAINT "LlmRequest_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_llmRequestId_fkey" FOREIGN KEY ("llmRequestId") REFERENCES "LlmRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRewardSession" ADD CONSTRAINT "AdRewardSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRewardEvent" ADD CONSTRAINT "AdRewardEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRewardEvent" ADD CONSTRAINT "AdRewardEvent_rewardSessionId_fkey" FOREIGN KEY ("rewardSessionId") REFERENCES "AdRewardSession"("rewardSessionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
