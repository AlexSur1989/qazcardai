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

    const genCountAfter = await prisma.generation.count();
    const txCountAfter = await prisma.creditTransaction.count();
    if (genCountAfter !== genCountBefore) fail("Generation count changed during smoke");
    if (txCountAfter !== txCountBefore) fail("CreditTransaction count changed during smoke");

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
