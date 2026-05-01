-- AlterTable
ALTER TABLE "ai_models" ADD COLUMN     "pricingSchema" JSONB,
ADD COLUMN     "payloadMapping" JSONB,
ADD COLUMN     "statusEndpoint" TEXT;
