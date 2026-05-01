-- CreateTable
CREATE TABLE "moderation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "generationId" TEXT,
    "modelId" TEXT,
    "flow" VARCHAR(64),
    "promptPreview" VARCHAR(500),
    "reason" TEXT NOT NULL,
    "rule" VARCHAR(128),
    "matchedText" VARCHAR(512),
    "severity" VARCHAR(16),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "moderation_logs_userId_createdAt_idx" ON "moderation_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "moderation_logs_createdAt_idx" ON "moderation_logs"("createdAt");

-- CreateIndex
CREATE INDEX "moderation_logs_generationId_idx" ON "moderation_logs"("generationId");

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "generations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_logs" ADD CONSTRAINT "moderation_logs_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;
