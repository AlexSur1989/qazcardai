import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { canAccessAdminPanel } from "@/lib/auth";
import { parseOutputFilesList } from "@/lib/generation-output-utils";
import { prisma } from "@/lib/prisma";
import { getSignedUrl, isStorageConfigured } from "@/server/services/storage";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Скачивание / открытие файла результата: 302 на публичный URL или presigned.
 */
export async function GET(req: Request, context: Ctx) {
  const { id } = await context.params;
  if (!id || id.length < 10) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const url = new URL(req.url);
  const indexRaw = url.searchParams.get("index");
  const index = indexRaw == null || indexRaw === "" ? 0 : Math.max(0, parseInt(indexRaw, 10) || 0);

  const generation = await prisma.generation.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      outputFiles: true,
    },
  });
  if (!generation) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const isAdmin = canAccessAdminPanel(session.user.role);
  if (generation.userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  const files = parseOutputFilesList(generation.outputFiles);
  const item = files[index];
  if (!item?.url && !item?.storageKey) {
    return NextResponse.json({ error: "Нет файла" }, { status: 404 });
  }

  if (item.storageKey && isStorageConfigured()) {
    try {
      const signed = await getSignedUrl(item.storageKey, 3600);
      return NextResponse.redirect(signed, 302);
    } catch {
      if (item.url) {
        return NextResponse.redirect(item.url, 302);
      }
      return NextResponse.json({ error: "Хранилище" }, { status: 502 });
    }
  }

  if (item.url) {
    return NextResponse.redirect(item.url, 302);
  }

  return NextResponse.json({ error: "Нет URL" }, { status: 404 });
}
