import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { simpleProductCardEstimateSchema } from "@/lib/validations/simple-product-card";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { assertMarketplaceCardScenarioEnabled } from "@/server/services/productCardScenarios";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import { estimateSimpleProductCard } from "@/server/services/simpleProductCardGeneration";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const gate = await assertMarketplaceCardScenarioEnabled();
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

  const parsed = simpleProductCardEstimateSchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  const res = await estimateSimpleProductCard(userId, id, parsed.data.payload);
  if (!res.ok) {
    return NextResponse.json({ error: res.error, code: res.code }, { status: res.status });
  }

  return NextResponse.json({
    credits: res.credits,
    planHash: res.planHash,
    supportsReference: res.supportsReference,
    modelSlug: res.modelSlug,
  });
}
