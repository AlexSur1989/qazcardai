-- CreateTable
CREATE TABLE "user_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "providerUserId" VARCHAR(255) NOT NULL,
    "username" VARCHAR(255),
    "displayName" VARCHAR(255),
    "avatarUrl" VARCHAR(2048),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_event_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" VARCHAR(128) NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "metadata" JSONB,
    "ipAddress" VARCHAR(128),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_identities_provider_providerUserId_key" ON "user_identities"("provider", "providerUserId");

-- CreateIndex
CREATE INDEX "user_identities_userId_idx" ON "user_identities"("userId");

-- AddForeignKey
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "auth_event_logs_userId_createdAt_idx" ON "auth_event_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "auth_event_logs_provider_createdAt_idx" ON "auth_event_logs"("provider", "createdAt");

-- AddForeignKey
ALTER TABLE "auth_event_logs" ADD CONSTRAINT "auth_event_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
