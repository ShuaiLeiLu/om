ALTER TABLE "ImageTask" ADD COLUMN "clientTaskId" TEXT;

CREATE INDEX "ImageTask_userId_clientTaskId_idx" ON "ImageTask"("userId", "clientTaskId");
