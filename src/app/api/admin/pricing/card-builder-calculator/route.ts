import { NextResponse } from "next/server";
import { z } from "zod";

import type { CardBuilderVisualStyleId } from "@/config/card-builder-universal";
import { derivePlanStyleFields } from "@/lib/card-builder-style-choice";
import { resolveCardBuilderPricingStyleForSlide } from "@/lib/card-builder-pricing-style";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  cardBuilderMultiplierFlags,
  computeCardBuilderCreditsBeforeMargin,
  estimateCardBuilderCharge,
} from "@/server/services/productCardPricing";
import { resolveCardBuilderImageModel } from "@/server/services/productCardModelResolver";
import { getProductCardSettings } from "@/server/services/productCardSettings";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["slide", "gallery6", "gallery8"]),
  slideRole: z.string().min(1),
  visualStyle: z.string().optional().default("auto"),
  textAmount: z.enum(["less", "more"]).optional().default("more"),
});

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const resolved = await resolveCardBuilderImageModel();
  if (!resolved) {
    return NextResponse.json({ error: "Модель card_builder не настроена" }, { status: 503 });
  }

  const settings = await getProductCardSettings();
  const pricing = settings.cardBuilderPricing;
  const { mode, slideRole, visualStyle, textAmount } = parsed.data;

  const style = resolveCardBuilderPricingStyleForSlide({
    slideRole,
    visualStyle: visualStyle as CardBuilderVisualStyleId,
    ...(() => {
      const derived = derivePlanStyleFields({
        visualStyle,
        textAmountToggle: textAmount,
      });
      return { salesStyle: derived.salesStyle, textDensity: derived.textDensity };
    })(),
  });

  const flags = cardBuilderMultiplierFlags(style.salesStyle, style.textDensity);
  const baseCredits = computeCardBuilderCreditsBeforeMargin(
    mode,
    pricing,
    flags,
  );

  const gallerySlideCount =
    mode === "gallery6" ? 6 : mode === "gallery8" ? 8 : null;

  const breakdown = await estimateCardBuilderCharge(
    mode,
    resolved.model,
    pricing,
    style.salesStyle,
    style.textDensity,
    slideRole,
    gallerySlideCount,
  );

  const multParts: string[] = [];
  if (flags.premiumStyle) multParts.push(`× ${pricing.multipliers.premiumStyle} premium`);
  if (flags.heavyText) multParts.push(`× ${pricing.multipliers.heavyTextInfographic} heavy text`);

  const baseRaw =
    mode === "slide"
      ? pricing.cardBuilderSingleSlideCredits
      : mode === "gallery6"
        ? pricing.cardBuilderGallery6Credits
        : pricing.cardBuilderGallery8Credits;

  const notes: string[] = [];
  if (slideRole === "main_photo") {
    notes.push("Для main_photo плотность текста ограничена — heavy/infographic множитель обычно не применяется.");
  }
  if (slideRole === "lifestyle") {
    notes.push("Для lifestyle инфографика автоматически смягчается (cozy_lifestyle / premium).");
  }
  if (slideRole === "benefits_infographic") {
    notes.push("benefits_infographic может сохранить infographic density → heavy multiplier.");
  }

  return NextResponse.json({
    effectiveSalesStyle: style.salesStyle,
    effectiveTextDensity: style.textDensity,
    baseCredits: baseRaw,
    multipliers: {
      premiumStyle: flags.premiumStyle,
      heavyText: flags.heavyText,
      premiumFactor: flags.premiumStyle ? pricing.multipliers.premiumStyle : 1,
      heavyFactor: flags.heavyText ? pricing.multipliers.heavyTextInfographic : 1,
    },
    finalCredits: breakdown.credits,
    formula: `${baseRaw}${multParts.length ? " " + multParts.join(" ") : ""} = ${breakdown.credits} токенов`,
    formulaDetail: breakdown.formula,
    notes,
    modelName: resolved.model.name,
    fallbackFromMarketplaceCard: resolved.fallbackFromMarketplaceCard,
  });
}
