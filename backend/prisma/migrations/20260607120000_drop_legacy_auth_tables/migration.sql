-- Move Casdoor identity links onto the business user/admin rows, then remove
-- local password, verification, OAuth mapping, WeChat login, and DB session tables.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "casdoorSubject" TEXT;
ALTER TABLE "AdminUser" ADD COLUMN IF NOT EXISTS "casdoorSubject" TEXT;

UPDATE "User" u
SET "casdoorSubject" = oa."openid"
FROM "OauthAccount" oa
WHERE oa."userId" = u."id"
  AND oa."provider" = 'casdoor'
  AND u."casdoorSubject" IS NULL;

ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt";
ALTER TABLE "AdminUser" DROP COLUMN IF EXISTS "passwordHash";

DROP TABLE IF EXISTS "EmailVerificationCode";
DROP TABLE IF EXISTS "AdminSession";
DROP TABLE IF EXISTS "UserSession";
DROP TABLE IF EXISTS "WechatQrSession";
DROP TABLE IF EXISTS "WechatMiniappSession";
DROP TABLE IF EXISTS "OauthAccount";

DROP TYPE IF EXISTS "VerificationStatus";
DROP TYPE IF EXISTS "VerificationPurpose";
DROP TYPE IF EXISTS "QrSessionStatus";
DROP TYPE IF EXISTS "QrSessionMode";
DROP TYPE IF EXISTS "SessionStatus";

CREATE UNIQUE INDEX IF NOT EXISTS "User_casdoorSubject_key" ON "User"("casdoorSubject");
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_casdoorSubject_key" ON "AdminUser"("casdoorSubject");
