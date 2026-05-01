import { NextResponse } from "next/server";

import { canAccessAdminPanel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length < 10) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const generation = await prisma.generation.findUnique({
    where: { id },
  });
  if (!generation) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (
    generation.userId !== current.user.id &&
    !canAccessAdminPanel(current.user.role)
  ) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  return NextResponse.json({
    id: generation.id,
    type: generation.type,
    status: generation.status,
    outputFiles: generation.outputFiles,
    errorMessage: generation.errorMessage,
    metadata: generation.metadata,
    createdAt: generation.createdAt.toISOString(),
    completedAt: generation.completedAt?.toISOString() ?? null,
  });
}
