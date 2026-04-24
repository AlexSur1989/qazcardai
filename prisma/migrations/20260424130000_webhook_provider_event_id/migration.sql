-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN "providerEventId" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_providerEventId_key" ON "webhook_events"("provider", "providerEventId");
