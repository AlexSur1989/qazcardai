import { NextResponse } from "next/server";

import { cardBuilderSlideTemplateBodySchema } from "@/lib/validations/card-builder-plan";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import {
  assertCardBuilderScenarioEnabled,
  updateCardBuilderSlideTemplate,
} from "@/server/services/productCardCardBuilderGeneration";
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
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = cardBuilderSlideTemplateBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const res = await updateCardBuilderSlideTemplate(userId, id, parsed.data.slideId, parsed.data.templateId);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, ...(res.code ? { code: res.code } : {}) },
      { status: res.status },
    );
  }
  return NextResponse.json({ slide: res.slide, galleryPlan: res.galleryPlan });
}
