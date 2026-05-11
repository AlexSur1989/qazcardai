import { NextResponse } from "next/server";
import { z } from "zod";

import { prismaErrorToJsonResponse } from "@/lib/prisma-api-error";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { updateProductSourceImages } from "@/server/services/productCardProjects";
import { tryAutoClassifyProductProject } from "@/server/services/productCardClassificationPersist";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const sourceImageSchema = z.object({
  fileId: z.string().trim().min(1),
  role: z.enum(["main", "side", "back", "detail"]),
  order: z.number().int().min(0).max(3),
});

const bodySchema = z.object({
  images: z.array(sourceImageSchema).min(1).max(4),
});

type Ctx = { params: Promise<{ id: string }> };

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

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id: projectId } = await ctx.params;
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

  try {
    const project = await updateProductSourceImages({
      userId,
      projectId,
      images: parsed.data.images,
    });
    const withCategory = await tryAutoClassifyProductProject(userId, project);
    return NextResponse.json({ project: withCategory });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (
      err.code === "INVALID_SOURCE_IMAGES" ||
      err.code === "MAIN_REQUIRED" ||
      err.code === "INVALID_ROLE" ||
      err.code === "INVALID_ORDER" ||
      err.code === "DUPLICATE_ORDER" ||
      err.code === "DUPLICATE_ROLE" ||
      err.code === "INVALID_FILE_ID" ||
      err.code === "UPLOADED_FILE_NOT_FOUND" ||
      err.code === "NOT_IMAGE" ||
      err.code === "INVALID_UPLOADED_FILE_URL"
    ) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
    return prismaErrorToJsonResponse(e, "Не удалось обновить фото товара.");
  }
}
