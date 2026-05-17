-- Email verification codes (register / reset_password / bind_email)

CREATE TYPE "VerificationPurpose" AS ENUM ('register', 'reset_password', 'bind_email');
CREATE TYPE "VerificationStatus" AS ENUM ('active', 'consumed', 'expired', 'exhausted');

CREATE TABLE "EmailVerificationCode" (
  "id"          TEXT NOT NULL,
  "email"       TEXT NOT NULL,
  "purpose"     "VerificationPurpose" NOT NULL,
  "codeHash"    TEXT NOT NULL,
  "status"      "VerificationStatus" NOT NULL DEFAULT 'active',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "ip"          TEXT NOT NULL DEFAULT '',
  "userAgent"   TEXT NOT NULL DEFAULT '',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerificationCode_email_purpose_status_idx"
  ON "EmailVerificationCode"("email", "purpose", "status");

CREATE INDEX "EmailVerificationCode_createdAt_idx"
  ON "EmailVerificationCode"("createdAt");
