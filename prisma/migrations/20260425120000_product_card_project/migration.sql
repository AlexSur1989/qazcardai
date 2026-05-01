-- CreateTable
CREATE TABLE "product_card_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "sourceImageFileId" TEXT,
    "sourceImageUrl" TEXT,
    "detectedCategory" VARCHAR(64),
    "selectedCategory" VARCHAR(64),
    "categorySource" VARCHAR(32),
    "status" VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_card_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_card_projects_userId_createdAt_idx" ON "product_card_projects"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "product_card_projects" ADD CONSTRAINT "product_card_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
