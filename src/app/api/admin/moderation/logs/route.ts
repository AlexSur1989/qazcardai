import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

function parseQ(req: Request, k: string): string | null {
  const u = new URL(req.url);
  return u.searchParams.get(k);
}

function parseIntQ(req: Request, k: string, d: number): number {
  const s = parseQ(req, k);
  if (s == null || s.trim() === "") return d;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
}

function parseDate(req: Request, k: string): Date | null {
  const s = parseQ(req, k);
  if (s == null || s.trim() === "") return null;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t);
}

export async function GET(req: Request) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }

  const page = Math.max(1, parseIntQ(req, "page", 1));
  const pageSize = Math.min(100, Math.max(1, parseIntQ(req, "pageSize", 20)));
  const userId = parseQ(req, "userId");
  const reasonQ = parseQ(req, "reason");
  const severity = parseQ(req, "severity");
  const dateFrom = parseDate(req, "dateFrom");
  const dateTo = parseDate(req, "dateTo");

  const where: Prisma.ModerationLogWhereInput = {};
  if (userId) {
    where.userId = userId;
  }
  if (reasonQ && reasonQ.trim()) {
    where.reason = { contains: reasonQ.trim(), mode: "insensitive" };
  }
  if (severity && severity.trim()) {
    where.severity = severity.trim();
  }
  if (dateFrom || dateTo) {
    const range: { gte?: Date; lte?: Date } = {};
    if (dateFrom) range.gte = dateFrom;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      range.lte = end;
    }
    where.createdAt = range;
  }

  const [rawItems, total] = await Promise.all([
    prisma.moderationLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true } },
        model: { select: { id: true, name: true } },
        generation: { select: { id: true, status: true } },
      },
    }),
    prisma.moderationLog.count({ where }),
  ]);

  const items = rawItems.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    userId: r.userId,
    userEmail: r.user?.email ?? null,
    generationId: r.generationId,
    generationStatus: r.generation?.status ?? null,
    modelId: r.modelId,
    modelName: r.model?.name ?? null,
    flow: r.flow,
    reason: r.reason,
    rule: r.rule,
    matchedText: r.matchedText,
    severity: r.severity,
    promptPreview: r.promptPreview,
  }));

  return NextResponse.json({ items, total, page, pageSize });
}
