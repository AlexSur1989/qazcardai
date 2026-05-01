import { NextResponse } from "next/server";
import { z } from "zod";

import { prismaErrorToJsonResponse } from "@/lib/prisma-api-error";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { attachSourceImageToProject } from "@/server/services/productCardProjects";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const bodySchema = z.object({
  fileId: z.string().min(1),
  /** Опционально, для отладки: должен совпадать с URL в БД; сервер доверяет только UploadedFile. */
  url: z.string().url().optional(),
});

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
    const project = await attachSourceImageToProject(
      userId,
      projectId,
      parsed.data.fileId,
    );
    return NextResponse.json({ project });
  } catch (e) {
    const err = e as Error & { code?: string };
    if (
      err.code === "FILE_FORBIDDEN" ||
      err.code === "UPLOADED_FILE_NOT_FOUND" ||
      err.code === "NOT_IMAGE" ||
      err.code === "NO_URL" ||
      err.code === "INVALID_UPLOADED_FILE_URL"
    ) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    if (err.code === "NOT_FOUND") {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
    return prismaErrorToJsonResponse(e, "Не удалось привязать фото к проекту.");
  }
}
