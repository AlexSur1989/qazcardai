ALTER TABLE "ai_models"
  ADD COLUMN "scope" VARCHAR(32) NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "productCardModelType" VARCHAR(64);

CREATE INDEX "ai_models_scope_type_isActive_idx"
  ON "ai_models"("scope", "type", "isActive");

CREATE INDEX "ai_models_scope_productCardModelType_isActive_idx"
  ON "ai_models"("scope", "productCardModelType", "isActive");
