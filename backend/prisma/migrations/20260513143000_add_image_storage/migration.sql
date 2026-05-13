-- CreateEnum
CREATE TYPE "ImageSource" AS ENUM ('upload', 'generated', 'system');

-- CreateEnum
CREATE TYPE "ImageTaskMode" AS ENUM ('generate', 'edit');

-- CreateEnum
CREATE TYPE "ImageTaskStatus" AS ENUM ('pending', 'running', 'done', 'failed', 'canceled');

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "source" "ImageSource" NOT NULL DEFAULT 'generated',
    "ownerUserId" TEXT,
    "refCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "mode" "ImageTaskMode" NOT NULL,
    "modelId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "paramsJson" JSONB NOT NULL,
    "status" "ImageTaskStatus" NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "requestId" TEXT NOT NULL,
    "sub2apiRequestId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageTaskInput" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "ImageTaskInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageTaskOutput" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "revisedPrompt" TEXT,

    CONSTRAINT "ImageTaskOutput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorageUsage" (
    "userId" TEXT NOT NULL,
    "bytesTotal" BIGINT NOT NULL DEFAULT 0,
    "imagesCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageUsage_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserImageRef" (
    "userId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "bytes" INTEGER NOT NULL,

    CONSTRAINT "UserImageRef_pkey" PRIMARY KEY ("userId","imageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Image_hash_key" ON "Image"("hash");

-- CreateIndex
CREATE INDEX "Image_ownerUserId_createdAt_idx" ON "Image"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTask_requestId_key" ON "ImageTask"("requestId");

-- CreateIndex
CREATE INDEX "ImageTask_userId_createdAt_idx" ON "ImageTask"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ImageTask_userId_status_idx" ON "ImageTask"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTaskInput_taskId_ordinal_key" ON "ImageTaskInput"("taskId", "ordinal");

-- CreateIndex
CREATE INDEX "ImageTaskInput_imageId_idx" ON "ImageTaskInput"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTaskOutput_taskId_ordinal_key" ON "ImageTaskOutput"("taskId", "ordinal");

-- CreateIndex
CREATE INDEX "ImageTaskOutput_imageId_idx" ON "ImageTaskOutput"("imageId");

-- CreateIndex
CREATE INDEX "UserImageRef_userId_idx" ON "UserImageRef"("userId");

-- CreateIndex
CREATE INDEX "UserImageRef_imageId_idx" ON "UserImageRef"("imageId");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTask" ADD CONSTRAINT "ImageTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTask" ADD CONSTRAINT "ImageTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTask" ADD CONSTRAINT "ImageTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LlmRequest"("requestId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTaskInput" ADD CONSTRAINT "ImageTaskInput_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ImageTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTaskInput" ADD CONSTRAINT "ImageTaskInput_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTaskOutput" ADD CONSTRAINT "ImageTaskOutput_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ImageTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageTaskOutput" ADD CONSTRAINT "ImageTaskOutput_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorageUsage" ADD CONSTRAINT "StorageUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserImageRef" ADD CONSTRAINT "UserImageRef_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserImageRef" ADD CONSTRAINT "UserImageRef_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE CASCADE ON UPDATE CASCADE;
