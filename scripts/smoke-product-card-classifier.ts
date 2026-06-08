/**
 * Безопасный smoke для PRODUCT_CLASSIFIER.
 * npm run smoke:product-card-classifier
 *
 * По умолчанию: setup + dry-run + missing/inactive API behavior. Без Kie.ai.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { PRODUCT_CLASSIFIER_SETUP_ERROR } from "../src/lib/product-classifier-result";
import {
  buildDryRunClassifierPayloadForModel,
  isCriticalClassifierDryRunWarning,
  validateClassifierDryRunPayloadShape,
} from "../src/server/services/adminClassifierPayloadDryRun";
import { runClassifierPreflight } from "../src/server/services/classifierPreflight";
import { runSafeProductClassifierFlow } from "../src/server/services/productClassifierFlow";
import { getProductCardModelSetupOverview } from "../src/server/services/productCardModelSetup";

const CLASSIFIER_SLUG = "gemini-3-flash-product-classifier";

function fail(msg: string): never {
  console.error(`[smoke:product-card-classifier] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL required");

  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const genCountBefore = await prisma.generation.count();
    const txCountBefore = await prisma.creditTransaction.count();

    const setup = await getProductCardModelSetupOverview();
    const classifierSlot = setup.byType.PRODUCT_CLASSIFIER;
    if (!classifierSlot) fail("classifier slot missing");

    console.log(
      `[smoke:product-card-classifier] classifier slot: ${classifierSlot.readinessStatus} slug=${classifierSlot.assignedSlug}`,
    );

    const missingFlow = await runSafeProductClassifierFlow({
      imageUrl: "https://example.com/product.jpg",
    });
    if (missingFlow.ok) {
      fail("classifier flow must not succeed without dev mock / real Kie flag");
    }
    if (missingFlow.error !== PRODUCT_CLASSIFIER_SETUP_ERROR) {
      fail(`setup error mismatch: ${missingFlow.error}`);
    }
    console.log("[smoke:product-card-classifier] missing/inactive setup error OK");

    const model = await prisma.aiModel.findUnique({ where: { slug: CLASSIFIER_SLUG } });
    if (model) {
      const dryRun = await buildDryRunClassifierPayloadForModel(model);
      if (!dryRun.ok) fail(`dry-run failed: ${dryRun.error}`);
      const critical = dryRun.warnings.filter(isCriticalClassifierDryRunWarning);
      if (critical.length > 0 && model.isActive) {
        fail(`active model has critical dry-run issues: ${critical.join("; ")}`);
      }
      const shape = validateClassifierDryRunPayloadShape(dryRun.payload);
      if (shape.length > 0) fail(`payload shape: ${shape.join("; ")}`);

      const payload = dryRun.payload as {
        model?: string;
        stream?: boolean;
        messages?: Array<{ content?: unknown }>;
      };
      if (payload.model !== "gemini-3-flash") {
        fail(`expected model=gemini-3-flash, got ${payload.model}`);
      }
      if (payload.stream !== false) fail("stream must be false");
      const userContent = payload.messages?.[1]?.content;
      if (!Array.isArray(userContent)) fail("messages[1].content must be array");
      const hasImage = userContent.some(
        (p) =>
          p &&
          typeof p === "object" &&
          !Array.isArray(p) &&
          (p as { type?: string }).type === "image_url",
      );
      if (!hasImage) fail("dry-run payload missing image_url");

      console.log("[smoke:product-card-classifier] dry-run chat payload OK");
    } else {
      console.log("[smoke:product-card-classifier] note: model not seeded yet");
    }

    const preflight = await runClassifierPreflight();
    if (!preflight.ok) fail("preflight returned ok=false");
    console.log(
      `[smoke:product-card-classifier] preflight readyForRealTest=${preflight.readyForRealTest}`,
    );

    const marketplaceSlot = setup.byType.PRODUCT_MARKETPLACE_CARD;
    if (!marketplaceSlot?.generationReady) {
      fail("classifier checks must not break marketplace Ready");
    }

    const genCountAfter = await prisma.generation.count();
    const txCountAfter = await prisma.creditTransaction.count();
    if (genCountAfter !== genCountBefore) fail("Generation count changed");
    if (txCountAfter !== txCountBefore) fail("CreditTransaction count changed");

    console.log("[smoke:product-card-classifier] OK — no Kie, no side effects");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
