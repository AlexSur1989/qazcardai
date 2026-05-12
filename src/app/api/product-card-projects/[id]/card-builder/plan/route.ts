import { NextResponse } from "next/server";

import type { CardBuilderGoalId, CardBuilderPreserveAspectId } from "@/config/card-builder-presets";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { cardBuilderWizardBodySchema } from "@/server/api/product-card-card-builder-validation";
import { persistCardBuilderGalleryPlan } from "@/server/services/productCardCardBuilder";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

type Ctx = { params: Promise<{ id: string }> };

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
  const parsed = cardBuilderWizardBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const settings = {
    marketplace: d.marketplace,
    goal: d.goal as CardBuilderGoalId,
    preserveProduct: d.preserveProduct,
    preserveAspects: d.preserveAspects as CardBuilderPreserveAspectId[],
    allowCreativeStyle: d.allowCreativeStyle,
    benefitsTags: d.benefitsTags,
    benefitsExtra: d.benefitsExtra?.trim(),
    mustShow: d.mustShow,
    audience: d.audience ?? null,
    priceSegment: d.priceSegment ?? null,
    salesStyle: d.salesStyle,
    textDensity: d.textDensity,
  };

  const result = await persistCardBuilderGalleryPlan(userId, id, settings);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ slides: result.slides, ok: true });
}
