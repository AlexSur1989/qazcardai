import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CARD_BUILDER_PROMPTS_DEFAULTS } from "@/config/card-builder-prompts-defaults";
import { UNIVERSAL_CARD_BUILDER_PROFILE } from "@/config/universal-card-builder-profile";
import {
  mergeCardBuilderPromptsWithDefaults,
  validateCardBuilderPromptsForSave,
} from "@/lib/validations/card-builder-prompts-setting";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { buildCardBuilderSuperPrompt } from "@/server/services/cardBuilderPromptBuilder";
import type { CardBuilderProductFact } from "@/lib/card-builder-product-facts";
import {
  getCardBuilderPromptsSettings,
  getCardBuilderVisionPromptFromSettings,
  PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY,
} from "@/server/services/cardBuilderPromptsSettings";
import { getAppSetting, setAppSettingFromRegistry } from "@/server/services/appSettings";

export const dynamic = "force-dynamic";

const Z_FACT = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  type: z.string(),
  lockedText: z.boolean().optional(),
  visibleOnCard: z.boolean().optional(),
});

const previewBodySchema = z.object({
  categoryKey: z.string().default("beauty_care"),
  slideRole: z.string().default("benefits_infographic"),
  templateId: z.string().default("benefits_grid"),
  productTitle: z.string().optional(),
  productNameGuess: z.string().optional(),
  productFacts: z.array(Z_FACT).optional().default([]),
  promptsOverride: z.record(z.string(), z.unknown()).optional(),
});

export async function GET() {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;

  const raw = await getAppSetting(PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY);
  const merged = await getCardBuilderPromptsSettings();
  const vision = await getCardBuilderVisionPromptFromSettings();

  return NextResponse.json({
    ok: true,
    raw: raw ?? null,
    effective: merged.prompts,
    source: merged.source,
    warnings: merged.warnings,
    defaults: CARD_BUILDER_PROMPTS_DEFAULTS,
    visionPreview: {
      version: vision.version,
      source: vision.source,
      prompt: vision.prompt,
    },
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("settings.manage");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("value" in body)) {
    return NextResponse.json({ error: "value_required" }, { status: 400 });
  }

  const res = await setAppSettingFromRegistry({
    key: PRODUCT_CARD_CARD_BUILDER_PROMPTS_KEY,
    value: (body as { value: unknown }).value,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  revalidatePath("/admin/product-card");
  revalidatePath("/admin/settings");
  return NextResponse.json({ ok: true, value: res.newValue });
}

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) return gate.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const mode =
    body && typeof body === "object" && "mode" in body
      ? String((body as { mode: unknown }).mode)
      : "validate";

  if (mode === "validate") {
    const value =
      body && typeof body === "object" && "value" in body
        ? (body as { value: unknown }).value
        : null;
    const valid = validateCardBuilderPromptsForSave(value);
    if (!valid.ok) {
      return NextResponse.json({ ok: false, errors: valid.errors }, { status: 400 });
    }
    return NextResponse.json({ ok: true, warnings: valid.warnings, value: valid.value });
  }

  if (mode === "preview") {
    const parsed = previewBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    }
    const p = parsed.data;
    let bundle = await getCardBuilderPromptsSettings();
    if (p.promptsOverride) {
      const merged = mergeCardBuilderPromptsWithDefaults(p.promptsOverride);
      bundle = { prompts: merged.prompts, source: merged.source, warnings: merged.warnings };
    }

    const built = buildCardBuilderSuperPrompt(
      {
        productTitle: p.productTitle ?? "Тестовый товар",
        productNameGuess: p.productNameGuess ?? "Тестовый товар",
        selectedCategory: "other",
        marketplace: "other",
        marketplaceProfile: UNIVERSAL_CARD_BUILDER_PROFILE,
        slideRole: p.slideRole,
        templateId: p.templateId,
        cardBuilderCategoryKey: p.categoryKey,
        productFacts: p.productFacts.map((f) => ({
          ...f,
          type: f.type as CardBuilderProductFact["type"],
          source: "user" as const,
        })),
        audience: "mass_market",
        priceSegment: "middle",
        salesStyle: "light_marketplace",
        textDensity: "medium",
        preserveProduct: true,
        preserveAspects: ["shape", "color"],
        languageMode: "auto",
      },
      bundle,
    );

    if (!built.ok) {
      return NextResponse.json({ ok: false, errors: built.validationErrors }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      prompt: built.data.prompt,
      promptMeta: built.data.promptMeta,
      exactTextPhrases: built.data.exactTextPhrases,
      warnings: bundle.warnings,
    });
  }

  return NextResponse.json({ error: "unknown_mode" }, { status: 400 });
}
