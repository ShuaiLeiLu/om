-- Add login-code support for WechatQrSession.
-- The Prisma schema already references this nullable column and composite index.
ALTER TABLE "WechatQrSession" ADD COLUMN IF NOT EXISTS "loginCode" TEXT;

CREATE INDEX IF NOT EXISTS "WechatQrSession_loginCode_mode_status_idx"
ON "WechatQrSession"("loginCode", "mode", "status");
