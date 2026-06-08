import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * Vision для Simple Product Card: пока без Kie — быстрый ответ для ручного заполнения.
 * Не вызывает Kie.ai и не тратит credits.
 */
export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(current.user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  let body: { productPhotoId?: string; saveToSimpleCard?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  if (!body.productPhotoId?.trim()) {
    return NextResponse.json({ error: "productPhotoId обязателен" }, { status: 400 });
  }

  return NextResponse.json({
    analysisFailed: true,
    warnings: [
      "Автораспознавание товара пока не подключено. Заполните название и преимущества вручную.",
    ],
    productPhotoId: body.productPhotoId.trim(),
  });
}
