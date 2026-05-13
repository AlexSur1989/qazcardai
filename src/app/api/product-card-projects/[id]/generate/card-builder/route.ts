import { NextResponse } from "next/server";

import { cardBuilderGenerateGalleryBodySchema } from "@/lib/validations/card-builder-plan";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  assertCardBuilderScenarioEnabled,
  generateCardBuilderAllSlides,
} from "@/server/services/productCardCardBuilderGeneration";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

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
  const gate = await assertCardBuilderScenarioEnabled();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error, code: gate.code }, { status: gate.status });
  }
  const userId = current.user.id;
  const rate = await enforceGenerationRateLimit(userId);
  if (rate) return rate;

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = {};
  }
  const parsed = cardBuilderGenerateGalleryBodySchema.safeParse(json ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const res = await generateCardBuilderAllSlides(
    userId,
    id,
    parsed.data.clientEstimateCredits ?? null,
  );
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, code: res.code },
      { status: res.status },
    );
  }
  return NextResponse.json({
    totalCredits: res.totalCredits,
    results: res.results,
  });
}
