import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { prismaErrorToJsonResponse } from "@/lib/prisma-api-error";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  getProductCardProject,
  updateProductCardProject,
} from "@/server/services/productCardProjects";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";
import { PRODUCT_CATEGORY_IDS } from "@/config/product-card-categories";

const patchBody = z.object({
  title: z.string().max(200).optional().nullable(),
  selectedCategory: z
    .string()
    .optional()
    .refine(
      (x) => x == null || (PRODUCT_CATEGORY_IDS as readonly string[]).includes(x),
      { message: "Некорректная категория" },
    ),
  categorySource: z.enum(["ai", "manual", "mock"]).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }
  const { id } = await ctx.params;
  let p: Awaited<ReturnType<typeof getOwnedProjectOrNull>>;
  try {
    p = await getOwnedProjectOrNull(current.user.id, id);
  } catch (e) {
    return prismaErrorToJsonResponse(
      e,
      "Не удалось загрузить проект карточки товара.",
    );
  }
  if (!p) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  return NextResponse.json({ project: p });
}

export async function PATCH(req: Request, ctx: Ctx) {
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

  const { id } = await ctx.params;
  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  let p;
  try {
    p = await getProductCardProject(userId, id);
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Не найдено" }, { status: 404 });
    }
    return prismaErrorToJsonResponse(e, "Не удалось обновить проект.");
  }

  const nextMeta: Prisma.InputJsonValue | undefined = d.metadata
    ? ({ ...((p.metadata as Record<string, unknown>) ?? {}), ...d.metadata } as Prisma.InputJsonValue)
    : undefined;

  try {
    const updated = await updateProductCardProject(userId, id, {
      title: d.title,
      selectedCategory: d.selectedCategory,
      categorySource: d.categorySource,
      ...(nextMeta != null ? { metadata: nextMeta } : {}),
    });
    return NextResponse.json({ project: updated });
  } catch (e) {
    return prismaErrorToJsonResponse(
      e,
      "Не удалось обновить проект карточки товара.",
    );
  }
}
