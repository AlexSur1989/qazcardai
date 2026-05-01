-- CreateTable
CREATE TABLE "token_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "priceKzt" INTEGER NOT NULL,
    "baseTokens" INTEGER NOT NULL,
    "bonusTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "token_packages_slug_key" ON "token_packages"("slug");

-- CreateIndex
CREATE INDEX "token_packages_isActive_sortOrder_idx" ON "token_packages"("isActive", "sortOrder");

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "tokenPackageId" TEXT;

-- CreateIndex
CREATE INDEX "payments_tokenPackageId_idx" ON "payments"("tokenPackageId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tokenPackageId_fkey" FOREIGN KEY ("tokenPackageId") REFERENCES "token_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
