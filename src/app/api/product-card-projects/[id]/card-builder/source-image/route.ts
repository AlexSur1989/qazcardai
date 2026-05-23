import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  clearCardBuilderSourceImage,
  saveCardBuilderSourceImage,
} from "@/server/services/cardBuilderSourceImage";
import { assertCardBuilderScenarioEnabled } from "@/server/services/productCardCardBuilderGeneration";
import { assertUserOwnsFileUrl, getOwnedProjectOrNull } from "@/server/services/productCardProjectAccess";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  url: z.string().trim().min(1, "url обязателен"),
  fileId: z.string().trim().min(1, "fileId обязателен"),
  fileName: z.string().trim().max(260).optional(),
  size: z.number().finite().positive().optional(),
});

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

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  const { id } = await ctx.params;
  const userId = current.user.id;
  const project = await getOwnedProjectOrNull(userId, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

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

  const { url, fileId, fileName, size } = parsed.data;
  if (!(await assertUserOwnsFileUrl(userId, url))) {
    return NextResponse.json({ error: "Нет доступа к файлу" }, { status: 403 });
  }

  await saveCardBuilderSourceImage(id, {
    url,
    fileId,
    ...(fileName ? { fileName } : {}),
    ...(size != null ? { size } : {}),
  });

  return NextResponse.json({ ok: true, url, fileId, fileName, size });
}

export async function DELETE(_req: Request, ctx: Ctx) {
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

  const { id } = await ctx.params;
  const project = await getOwnedProjectOrNull(current.user.id, id);
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  await clearCardBuilderSourceImage(id);
  return NextResponse.json({ ok: true });
}
