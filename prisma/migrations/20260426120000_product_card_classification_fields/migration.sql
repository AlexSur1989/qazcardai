-- AlterTable
ALTER TABLE "product_card_projects" ADD COLUMN     "classificationConfidence" DOUBLE PRECISION;
ALTER TABLE "product_card_projects" ADD COLUMN     "classificationReason" TEXT;

-- AddForeignKey
ALTER TABLE "product_card_projects" ADD CONSTRAINT "product_card_projects_sourceImageFileId_fkey" FOREIGN KEY ("sourceImageFileId") REFERENCES "uploaded_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "product_card_projects_sourceImageFileId_idx" ON "product_card_projects"("sourceImageFileId");
