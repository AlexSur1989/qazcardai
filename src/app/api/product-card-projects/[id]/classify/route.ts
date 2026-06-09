import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { normalizeProductSourceImages } from "@/server/services/productCardProjects";
import {
  enforceProductClassifyRateLimit,
} from "@/server/services/rateLimitService";
import { executeProductClassifierClassify } from "@/server/services/productClassifierClassifyRequest";

type Ctx = { params: Promise<{ id: string }> };

function classifyErrorStatus(code: string): number {
  if (code === "setup") return 503;
  if (code === "insufficient_credits") return 402;
  if (code === "daily_limit" || code === "cooldown") return 429;
  if (code === "invalid_mock") return 400;
  return 502;
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

  const outcome = await executeProductClassifierClassify({
    userId,
    userRole: current.user.role,
    projectId: id,
    imageUrl: url,
    devMockCategory: devMockKey,
  });

  if (!outcome.ok) {
    const status = classifyErrorStatus(outcome.code);
    return NextResponse.json(
      {
        ok: false,
        error: outcome.error,
        code: outcome.code,
        ...(outcome.retryAfter != null ? { retryAfter: outcome.retryAfter } : {}),
      },
      {
        status,
        ...(outcome.retryAfter != null
          ? { headers: { "Retry-After": String(outcome.retryAfter) } }
          : {}),
      },
    );
  }

  return NextResponse.json({
    ok: true,
    result: outcome.result,
    ...(outcome.billing ? { billing: outcome.billing } : {}),
  });
}
