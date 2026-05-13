import { NextResponse } from "next/server";

import {
  cardBuilderEstimateRequestSchema,
  cardBuilderPlanFieldsSchema,
} from "@/lib/validations/card-builder-plan";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { allocateCreditsAcrossVariants, estimateCardBuilderCharge } from "@/server/services/productCardPricing";
import { resolveCardBuilderImageModel } from "@/server/services/productCardModelResolver";
import { readCardBuilderBlock } from "@/server/services/productCardCardBuilderMeta";
import { assertCardBuilderScenarioEnabled } from "@/server/services/productCardCardBuilderGeneration";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import {
  PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE,
  getProductCardSettings,
} from "@/server/services/productCardSettings";
import {
  buildCardBuilderGalleryPlan,
  cardBuilderGoalToSlideRole,
} from "@/server/services/productCardBuilderPlan";
import {
  marketplaceBenefitsOverLimitMessage,
  resolveProductCardMarketplaceProfile,
} from "@/server/services/productCardMarketplaceProfiles";
import {
  cardBuilderLivePlanFingerprintInputs,
  computeCardBuilderPlanFingerprint,
} from "@/server/services/cardBuilderPlanFingerprint";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";

import type { CardBuilderGallerySlide } from "@/server/services/productCardBuilderPlan";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function galleryBundleKind(goal: string, slideCount: number): "gallery6" | "gallery8" | null {
  if (goal === "full_gallery_6" && slideCount === 6) return "gallery6";
  if (goal === "full_gallery_8" && slideCount === 8) return "gallery8";
  return null;
}

/** Параметр textDensity совпадает с generate для pricing (главное фото без текста при правилах площадки). */
function textDensityEffectiveForSlide(
  profile: { mainPhotoTextAllowed: boolean },
  slideRole: string,
  savedTextDensity: string,
): string {
  if (slideRole === "main_photo" && !profile.mainPhotoTextAllowed) return "none";
  return savedTextDensity;
}

function slidesForFingerprint(
  source: "payload" | "saved",
  plan: Parameters<typeof buildCardBuilderGalleryPlan>[0],
  blk: Awaited<ReturnType<typeof readCardBuilderBlock>>,
  profile: Parameters<typeof buildCardBuilderGalleryPlan>[1],
): CardBuilderGallerySlide[] {
  if (source === "saved" && blk?.galleryPlan?.length) {
    return blk.galleryPlan as CardBuilderGallerySlide[];
  }
  return buildCardBuilderGalleryPlan(plan, profile).slides;
}

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const gate = await assertCardBuilderScenarioEnabled();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
  }

  const userId = current.user.id;
  const rate = await enforceGenerationRateLimit(userId);
  if (rate) return rate;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = cardBuilderEstimateRequestSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;

  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const blk =
    parsed.data.source === "saved" ? await readCardBuilderBlock(id) : null;

  let plan = parsed.data.payload;
  if (parsed.data.source === "saved") {
    if (!blk?.settings) {
      return NextResponse.json(
        { error: "Нет сохранённых параметров — сначала сохраните структуру" },
        { status: 400 },
      );
    }
    const { updatedAt: _u, ...rest } = blk.settings;
    void _u;
    const pv = cardBuilderPlanFieldsSchema.safeParse(rest);
    if (!pv.success) {
      return NextResponse.json(
        { error: "Сохранённые параметры устарели — сгенерируйте структуру заново" },
        { status: 400 },
      );
    }
    plan = pv.data;
  }

  if (!plan) {
    return NextResponse.json({ error: "Нужны параметры структуры" }, { status: 400 });
  }

  const mpRes = await resolveProductCardMarketplaceProfile(plan.marketplace);
  if (!mpRes.ok) {
    return NextResponse.json({ error: mpRes.error, code: mpRes.code }, { status: mpRes.status });
  }

  const benefitErr = marketplaceBenefitsOverLimitMessage(plan.benefits, mpRes.profile);
  if (benefitErr) {
    return NextResponse.json(
      { error: benefitErr, code: "CARD_BUILDER_TOO_MANY_BENEFITS" },
      { status: 400 },
    );
  }

  const model = (await resolveCardBuilderImageModel())?.model ?? null;
  if (!model) {
    return NextResponse.json({ error: PRODUCT_CARD_MODEL_NOT_CONFIGURED_MESSAGE }, { status: 400 });
  }
  const settings = await getProductCardSettings();

  const slides = slidesForFingerprint(parsed.data.source, plan, blk, mpRes.profile);
  const planHash = computeCardBuilderPlanFingerprint(
    cardBuilderLivePlanFingerprintInputs(plan, mpRes.profile.id),
    slides,
  );

  if (parsed.data.mode === "single_slide") {
    let pricingRole =
      cardBuilderGoalToSlideRole(plan.goal) ?? slides[0]?.imageRole ?? "main_photo";

    const activeId = parsed.data.activeSlideId?.trim();
    if (activeId) {
      const found = slides.find((s) => s.slideId === activeId)?.imageRole;
      if (found) pricingRole = found;
    }

    const textDensityEffective = textDensityEffectiveForSlide(
      mpRes.profile,
      pricingRole,
      plan.textDensity,
    );

    const br = await estimateCardBuilderCharge(
      "slide",
      model,
      settings.cardBuilderPricing,
      plan.salesStyle,
      textDensityEffective,
      pricingRole,
      null,
    );
    return NextResponse.json({
      credits: br.credits,
      planHash,
      slideCount: slides.length,
      slideRoleEstimated: pricingRole,
    });
  }

  const bundle = galleryBundleKind(plan.goal, slides.length);
  let totalCredits: number;

  if (bundle) {
    const br = await estimateCardBuilderCharge(
      bundle,
      model,
      settings.cardBuilderPricing,
      plan.salesStyle,
      plan.textDensity,
      "gallery_bundle",
      slides.length,
    );
    totalCredits = br.credits;
  } else {
    let sum = 0;
    for (const s of slides) {
      const dens = textDensityEffectiveForSlide(mpRes.profile, s.imageRole, plan.textDensity);
      const br = await estimateCardBuilderCharge(
        "slide",
        model,
        settings.cardBuilderPricing,
        plan.salesStyle,
        dens,
        s.imageRole,
        null,
      );
      sum += br.credits;
    }
    totalCredits = sum;
  }

  const alloc =
    slides.length <= 1 ? [totalCredits] : allocateCreditsAcrossVariants(totalCredits, slides.length);

  return NextResponse.json({
    credits: totalCredits,
    slideCount: slides.length,
    allocations: alloc,
    planHash,
  });
}
