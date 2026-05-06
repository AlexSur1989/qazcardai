import { NextResponse } from "next/server";
import { z } from "zod";

import { MARKETPLACE_CARD_STYLES } from "@/config/product-card-categories";
import {
  isProductCardTemplatePresetId,
  isProductCardTypographyPresetId,
} from "@/config/product-card-overlay-presets";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import {
  generateMarketplaceCardForProductCard,
  generateMarketplaceCardVariantsForProductCard,
} from "@/server/services/productCardGeneration";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const styleSet = new Set(MARKETPLACE_CARD_STYLES.map((s) => s.id));

const bodySchema = z.object({
  sourceType: z.enum(["original", "concept_generation"]),
  sourceGenerationId: z.string().nullable().optional(),
  generationMode: z.enum(["marketplace_card", "marketplace_card_variants"]).optional().default("marketplace_card"),
  variantCount: z.number().int().min(1).max(6).optional().default(6),
  productTitle: z.string().max(120).optional().default(""),
  subtitle: z.string().max(160).optional().default(""),
  benefits: z
    .union([z.array(z.string().max(80)).max(8), z.string().max(2000)])
    .optional()
    .default(""),
  extraText: z.string().max(200).optional().default(""),
  statsText: z.string().max(120).optional().default(""),
  sizeText: z.string().max(120).optional().default(""),
  style: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof MARKETPLACE_CARD_STYLES)[number]["id"]), "Некорректный стиль"),
  cardSize: z.string().trim().min(1).max(64).optional().default("square"),
  overlayTemplate: z.string().trim().min(1).max(64).optional().default("bottom_panel"),
  templatePreset: z.string().trim().min(1).max(64).optional().default("light_marketplace")
    .refine((s) => isProductCardTemplatePresetId(s), "Некорректный шаблон карточки"),
  typographyPreset: z.string().trim().min(1).max(64).optional().default("classic")
    .refine((s) => isProductCardTypographyPresetId(s), "Некорректная типографика"),
  preserveProductLabel: z.boolean().optional().default(false),
  useIcons: z.boolean().optional().default(true),
  useArrows: z.boolean().optional().default(true),
  useShadows: z.boolean().optional().default(true),
  userInstructions: z.string().max(1000).optional().default(""),
  clientEstimateCredits: z.number().int().nonnegative().optional().nullable(),
});

type Ctx = { params: Promise<{ id: string }> };

function normalizeBenefits(
  raw: string | string[] | undefined,
): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => x.trim()).filter(Boolean).slice(0, 8).map((s) => s.slice(0, 80));
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((s) => s.slice(0, 80));
}

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const userId = current.user.id;
  const rate = await enforceGenerationRateLimit(userId);
  if (rate) return rate;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }
  if (
    parsed.data.sourceType === "concept_generation" &&
    !parsed.data.sourceGenerationId?.trim()
  ) {
    return NextResponse.json(
      { error: "Укажите сгенерированное фото" },
      { status: 400 },
    );
  }
  const benefitsList = normalizeBenefits(parsed.data.benefits);
  const generationMode = parsed.data.generationMode;
  const variantCount = generationMode === "marketplace_card_variants" ? parsed.data.variantCount || 6 : 1;
  const commonInput = {
    userId,
    projectId: id,
    sourceType: parsed.data.sourceType,
    sourceGenerationId: parsed.data.sourceGenerationId?.trim() ?? null,
    productTitle: parsed.data.productTitle.trim(),
    subtitle: parsed.data.subtitle.trim(),
    benefits: benefitsList,
    extraText: parsed.data.extraText.trim(),
    statsText: parsed.data.statsText.trim(),
    sizeText: parsed.data.sizeText.trim(),
    style: parsed.data.style,
    cardSize: parsed.data.cardSize,
    overlayTemplate: parsed.data.overlayTemplate,
    templatePreset: parsed.data.templatePreset,
    typographyPreset: parsed.data.typographyPreset,
    preserveProductLabel: parsed.data.preserveProductLabel,
    useIcons: parsed.data.useIcons,
    useArrows: parsed.data.useArrows,
    useShadows: parsed.data.useShadows,
    userInstructions: parsed.data.userInstructions.trim(),
    clientEstimateCredits: parsed.data.clientEstimateCredits ?? null,
  };
  const result = generationMode === "marketplace_card_variants"
    ? await generateMarketplaceCardVariantsForProductCard({ ...commonInput, variantCount })
    : await generateMarketplaceCardForProductCard({ ...commonInput, generationMode: "marketplace_card" });

  if (!result.ok) {
    if (result.code === "PRICE_CHANGED") {
      return NextResponse.json(
        { error: result.error, code: "PRICE_CHANGED" },
        { status: result.status },
      );
    }
    return NextResponse.json(
      {
        error: result.error,
        ...(result.reason ? { reason: result.reason } : {}),
      },
      { status: result.status },
    );
  }

  if ("generationIds" in result) {
    return NextResponse.json({
      generationIds: result.generationIds,
      variants: result.variants,
      status: result.status,
      costCredits: result.costCredits,
      variantGroupId: result.variantGroupId,
      variantCount: result.variantCount,
    });
  }
  return NextResponse.json({
    generationId: result.generationId,
    status: result.status,
    costCredits: result.costCredits,
  });
}
