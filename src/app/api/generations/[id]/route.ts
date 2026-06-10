import { NextResponse } from "next/server";

import { canAccessAdminPanel } from "@/lib/auth";
import { fixUtf8MojibakeDisplay } from "@/lib/fix-utf8-mojibake-display";
import { serializeGenerationPollSnapshotForUser } from "@/lib/generation-display";
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
    select: {
      id: true,
      userId: true,
      type: true,
      status: true,
      outputFiles: true,
      errorMessage: true,
      metadata: true,
      createdAt: true,
      completedAt: true,
      costCredits: true,
      providerTaskId: true,
      model: { select: { id: true, slug: true, apiModelId: true } },
    },
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

  const isAdmin = canAccessAdminPanel(current.user.role);
  const errorRaw = fixUtf8MojibakeDisplay(generation.errorMessage);
  const metaRoot =
    generation.metadata && typeof generation.metadata === "object" && !Array.isArray(generation.metadata)
      ? (generation.metadata as Record<string, unknown>)
      : null;

  const snapshot = serializeGenerationPollSnapshotForUser({
    id: generation.id,
    type: generation.type,
    status: generation.status,
    costCredits: generation.costCredits,
    createdAt: generation.createdAt,
    completedAt: generation.completedAt,
    outputFiles: generation.outputFiles,
    metadata: generation.metadata,
    errorMessage: errorRaw,
    model: generation.model,
  });

  return NextResponse.json({
    ...snapshot,
    ...(isAdmin
      ? {
          admin: {
            providerTaskId: generation.providerTaskId,
            modelSlug: generation.model.slug,
            apiModelId: generation.model.apiModelId,
            providerInputImages: metaRoot
              ? {
                  originalProductUrl: metaRoot.originalProductUrl ?? null,
                  originalReferenceUrl: metaRoot.originalReferenceUrl ?? null,
                  providerProductUrl: metaRoot.providerProductUrl ?? null,
                  providerReferenceUrl: metaRoot.providerReferenceUrl ?? null,
                  providerUploadMethod: metaRoot.providerUploadMethod ?? null,
                  preflight: metaRoot.providerInputImagesPreflight ?? null,
                  preparedAt: metaRoot.providerInputImagesPreparedAt ?? null,
                }
              : null,
          },
        }
      : {}),
  });
}
