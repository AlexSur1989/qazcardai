/**
 * Безопасный smoke для PRODUCT_MARKETPLACE_CARD.
 * npm run smoke:product-card-marketplace
 *
 * По умолчанию: preflight + dry-run + estimate. Без Kie.ai, Generation, CreditTransaction.
 *
 * Real Kie.ai намеренно не поддерживается — используйте UI (/admin или user flow) вручную.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { runMarketplaceCardPreflight } from "../src/server/services/marketplaceCardPreflight";
import { getMarketplaceCardPricingSummary } from "../src/server/services/marketplaceCardPricingSummary";
import {
  buildDryRunKiePayloadForModel,
  isCriticalModelDryRunWarning,
  validateDryRunPayloadShape,
} from "../src/server/services/adminModelPayloadDryRun";
import { getProductCardSettings } from "../src/server/services/productCardSettings";
import { getProductCardModelSetupOverview } from "../src/server/services/productCardModelSetup";
import {
  serializeGenerationPollSnapshotForUser,
  serializeGenerationListItemForUser,
} from "../src/lib/generation-display";
import { PRODUCT_CLASSIFIER_SETUP_ERROR } from "../src/lib/product-classifier-result";
import { isClassifierRuntimeEnabled } from "../src/lib/product-classifier-runtime-gate";
import { runSafeProductClassifierFlow } from "../src/server/services/productClassifierFlow";
import {
  creditTransactionUserTypeLabel,
  shouldShowCreditTransactionToUser,
} from "../src/lib/credit-labels";
import type { GenerationStatus, GenerationType } from "../src/generated/prisma/enums";

const MARKETPLACE_MODEL_SLUG = "gpt-image-2-product-marketplace-card";

const args = process.argv.slice(2);
const wantsReal = args.includes("--real") || args.includes("--confirm-real-kie-charge");

function fail(msg: string): never {
  console.error(`[smoke:product-card-marketplace] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  if (wantsReal) {
    fail(
      "Real Kie.ai call is disabled. Pass --real --confirm-real-kie-charge to continue.\n" +
        "Этот скрипт не выполняет real test. Запускайте генерацию только через UI после явного подтверждения.",
    );
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL required");

  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const genCountBefore = await prisma.generation.count();
    const txCountBefore = await prisma.creditTransaction.count();

    const preflight = await runMarketplaceCardPreflight();
    const pcSettings = await getProductCardSettings();

    const model = await prisma.aiModel.findUnique({ where: { slug: MARKETPLACE_MODEL_SLUG } });
    if (!model?.isActive) fail(`model ${MARKETPLACE_MODEL_SLUG} missing or inactive`);

    const pricing = await getMarketplaceCardPricingSummary(model, pcSettings);

    console.log("[smoke:product-card-marketplace] preflight readyForRealTest:", preflight.readyForRealTest);
    console.log("[smoke:product-card-marketplace] final price:", pricing.finalCredits, "tokens");
    console.log("[smoke:product-card-marketplace] model:", preflight.modelSlug ?? MARKETPLACE_MODEL_SLUG);
    console.log("[smoke:product-card-marketplace] MOCK_KIE:", preflight.mockKie);
    console.log("[smoke:product-card-marketplace] queueMode:", preflight.queueMode);

    if (!preflight.ok) fail("preflight returned ok=false");
    if (preflight.warnings.length > 0) {
      console.warn("[smoke:product-card-marketplace] warnings:", preflight.warnings.join("; "));
    }

    const dryRun = await buildDryRunKiePayloadForModel(model, {
      prompt: "Smoke dry-run prompt for marketplace card.",
      settings: { aspectRatio: "1:1", resolution: "1K" },
      inputFiles: ["https://example.com/smoke-product.jpg"],
    });
    if (!("payload" in dryRun)) fail(dryRun.error);

    const shapeWarnings = validateDryRunPayloadShape(dryRun.payload, model);
    const shapeCritical = shapeWarnings.filter(isCriticalModelDryRunWarning);
    if (shapeCritical.length > 0) fail(`dry-run payload shape: ${shapeCritical.join("; ")}`);

    const input = (dryRun.payload as { input?: Record<string, unknown> }).input;
    if (!Array.isArray(input?.input_urls)) {
      fail("dry-run payload: input.input_urls must be array");
    }

    const mockMeta = {
      productCard: { tab: "marketplace_card", projectId: "smoke-project" },
      flow: "product_card",
    };
    const pollSnapshot = serializeGenerationPollSnapshotForUser({
      id: "smoke-gen-id",
      type: "IMAGE" as GenerationType,
      status: "COMPLETED" as GenerationStatus,
      costCredits: pricing.finalCredits,
      createdAt: new Date(),
      completedAt: new Date(),
      outputFiles: [{ url: "https://example.com/out.png", kind: "image" }],
      metadata: mockMeta,
      errorMessage: null,
      model: { id: model.id },
    });
    const pollJson = JSON.stringify(pollSnapshot);
    if (/providerTaskId|apiModelId|payloadMapping|endpoint|kie\.ai/i.test(pollJson)) {
      fail("poll snapshot leaks technical fields for USER");
    }
    if (!pollSnapshot.downloadUrl?.includes("/api/generations/")) {
      fail("poll snapshot missing safe downloadUrl");
    }

    const listItem = serializeGenerationListItemForUser({
      id: "smoke-gen-id",
      type: "IMAGE" as GenerationType,
      status: "COMPLETED" as GenerationStatus,
      costCredits: pricing.finalCredits,
      createdAt: new Date(),
      outputFiles: [{ url: "https://example.com/out.png", kind: "image" }],
      metadata: mockMeta,
      model: { id: model.id },
    });
    if (listItem.scenarioLabel !== "Карточка товара") {
      fail(`history scenarioLabel=${listItem.scenarioLabel}`);
    }
    if (!listItem.downloadUrl?.startsWith("/api/generations/")) {
      fail("history list missing safe downloadUrl");
    }

    if (creditTransactionUserTypeLabel("RESERVE", "Резерв: карточка товара (фото)") !== "Создание карточки товара") {
      fail("billing RESERVE label unexpected");
    }
    if (shouldShowCreditTransactionToUser({ type: "CAPTURE", amount: 0 })) {
      fail("CAPTURE 0 must be hidden from user billing");
    }

    const genCountAfter = await prisma.generation.count();
    const txCountAfter = await prisma.creditTransaction.count();
    if (genCountAfter !== genCountBefore) fail("Generation count changed during smoke");
    if (txCountAfter !== txCountBefore) fail("CreditTransaction count changed during smoke");

    const modelSetup = await getProductCardModelSetupOverview();
    const classifierSlot = modelSetup.byType.PRODUCT_CLASSIFIER;
    const marketplaceSlot = modelSetup.byType.PRODUCT_MARKETPLACE_CARD;
    if (!classifierSlot) fail("classifier slot missing in model setup");
    if (classifierSlot.autoClassifyReady && !isClassifierRuntimeEnabled()) {
      fail("classifier autoClassifyReady must be false when runtime gate disabled");
    }
    if (
      classifierSlot.readinessStatus === "ConfiguredDisabled" &&
      classifierSlot.autoClassifyReady
    ) {
      fail("ConfiguredDisabled slot must not have autoClassifyReady=true");
    }
    const classifierFlow = await runSafeProductClassifierFlow({
      imageUrl: "https://example.com/product.jpg",
    });
    if (classifierFlow.ok) {
      fail("classifier must not succeed in smoke without dev mock / real Kie flag");
    }
    if (classifierFlow.error !== PRODUCT_CLASSIFIER_SETUP_ERROR) {
      fail(`classifier smoke setup error mismatch: ${classifierFlow.error}`);
    }
    if (!marketplaceSlot?.generationReady) {
      fail("classifier not real-ready must not block marketplace Ready");
    }
    console.log(
      `[smoke:product-card-marketplace] classifier ${classifierSlot.readinessStatus}: manual fallback OK`,
    );

    console.log("[smoke:product-card-marketplace] OK — dry-run shape valid, no side effects");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
