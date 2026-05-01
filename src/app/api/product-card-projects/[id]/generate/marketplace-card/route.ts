import { NextResponse } from "next/server";
import { z } from "zod";

import { MARKETPLACE_CARD_STYLES } from "@/config/product-card-categories";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { generateMarketplaceCardForProductCard } from "@/server/services/productCardGeneration";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const styleSet = new Set(MARKETPLACE_CARD_STYLES.map((s) => s.id));

const bodySchema = z.object({
  sourceType: z.enum(["original", "concept_generation"]),
  sourceGenerationId: z.string().nullable().optional(),
  productTitle: z.string().max(120).optional().default(""),
  benefits: z
    .union([z.array(z.string().max(80)).max(8), z.string().max(2000)])
    .optional()
    .default(""),
  extraText: z.string().max(200).optional().default(""),
  style: z
    .string()
    .min(1)
    .refine((s) => styleSet.has(s as (typeof MARKETPLACE_CARD_STYLES)[number]["id"]), "Некорректный стиль"),
  cardSize: z.string().trim().min(1).max(64).optional().default("square"),
  overlayTemplate: z.string().trim().min(1).max(64).optional().default("bottom_panel"),
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
  const result = await generateMarketplaceCardForProductCard({
    userId,
    projectId: id,
    sourceType: parsed.data.sourceType,
    sourceGenerationId: parsed.data.sourceGenerationId?.trim() ?? null,
    productTitle: parsed.data.productTitle.trim(),
    benefits: benefitsList,
    extraText: parsed.data.extraText.trim(),
    style: parsed.data.style,
    cardSize: parsed.data.cardSize,
    overlayTemplate: parsed.data.overlayTemplate,
    userInstructions: parsed.data.userInstructions.trim(),
    clientEstimateCredits: parsed.data.clientEstimateCredits ?? null,
  });

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

  return NextResponse.json({
    generationId: result.generationId,
    status: result.status,
    costCredits: result.costCredits,
  });
}
