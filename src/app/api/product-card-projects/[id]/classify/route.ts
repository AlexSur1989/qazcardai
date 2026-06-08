import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import { enforceProductClassifyRateLimit } from "@/server/services/rateLimitService";
import { runSafeProductClassifierFlow } from "@/server/services/productClassifierFlow";

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
  const rate = await enforceProductClassifyRateLimit(userId);
  if (rate) return rate;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }
  const sourceImages = normalizeProductSourceImages(project);
  const main =
    sourceImages.find((s) => s.role === "main") ?? sourceImages[0] ?? null;
  const url = main?.url?.trim() ?? project.sourceImageUrl?.trim();
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Сначала загрузите фото товара" },
      { status: 400 },
    );
  }

  const urlObj = new URL(req.url);
  const devMockFromQuery = urlObj.searchParams.get("classifierMock");
  let devMockFromBody: string | null = null;
  try {
    const body = await req.clone().json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const mock = (body as { classifierMock?: unknown }).classifierMock;
      if (typeof mock === "string") devMockFromBody = mock;
    }
  } catch {
    // empty body is OK
  }

  const devMockKey = devMockFromQuery ?? devMockFromBody;

  const outcome = await runSafeProductClassifierFlow({
    devMockCategory: devMockKey,
    imageUrl: url,
  });

  if (!outcome.ok) {
    const status =
      outcome.code === "setup" ? 503 : outcome.code === "invalid_mock" ? 400 : 502;
    return NextResponse.json({ ok: false, error: outcome.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    result: outcome.result,
  });
}
