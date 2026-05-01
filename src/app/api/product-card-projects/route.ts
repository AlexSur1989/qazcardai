import { NextResponse } from "next/server";
import { z } from "zod";

import { prismaErrorToJsonResponse } from "@/lib/prisma-api-error";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { createProductCardProject } from "@/server/services/productCardProjects";
import { enforceGenerationRateLimit } from "@/server/services/rateLimitService";

const createBody = z.object({
  title: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request) {
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  const parsed = createBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  try {
    const project = await createProductCardProject(userId, {
      title: parsed.data.title,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return prismaErrorToJsonResponse(
      e,
      "Не удалось создать проект карточки товара.",
    );
  }
}
