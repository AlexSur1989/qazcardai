import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { canAccessAdminPanel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length < 10) {
    return NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const generation = await prisma.generation.findUnique({
    where: { id },
  });
  if (!generation) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const isAdmin = canAccessAdminPanel(session.user.role);
  if (generation.userId !== session.user.id && !isAdmin) {
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
