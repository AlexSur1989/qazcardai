-- CreateEnum
CREATE TYPE "UserTokenPackageStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "user_token_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "paymentId" TEXT,
    "packageName" TEXT NOT NULL,
    "priceKzt" INTEGER NOT NULL,
    "baseTokens" INTEGER NOT NULL,
    "bonusTokens" INTEGER NOT NULL,
    "totalTokens" INTEGER NOT NULL,
    "status" "UserTokenPackageStatus" NOT NULL DEFAULT 'COMPLETED',
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_token_packages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_token_packages_paymentId_key" ON "user_token_packages"("paymentId");

-- CreateIndex
CREATE INDEX "user_token_packages_userId_purchasedAt_idx" ON "user_token_packages"("userId", "purchasedAt");

-- CreateIndex
CREATE INDEX "user_token_packages_packageId_idx" ON "user_token_packages"("packageId");

-- CreateIndex
CREATE INDEX "user_token_packages_status_idx" ON "user_token_packages"("status");

-- AddForeignKey
ALTER TABLE "user_token_packages" ADD CONSTRAINT "user_token_packages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_token_packages" ADD CONSTRAINT "user_token_packages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "token_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_token_packages" ADD CONSTRAINT "user_token_packages_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
