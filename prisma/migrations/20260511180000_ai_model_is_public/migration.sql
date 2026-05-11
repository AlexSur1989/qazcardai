ALTER TABLE "ai_models"
  ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ai_models_scope_type_isActive_isPublic_idx"
  ON "ai_models"("scope", "type", "isActive", "isPublic");
