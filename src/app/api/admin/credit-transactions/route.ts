import { NextResponse } from "next/server";
import type { CreditTransactionType } from "@/generated/prisma/enums";

import { getCreditTransactionList } from "@/server/services/financeAdmin";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

const TYPES = new Set<CreditTransactionType>([
  "PURCHASE",
  "RESERVE",
  "CAPTURE",
  "REFUND",
  "ADMIN_ADJUSTMENT",
  "PROMO",
]);

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Number.parseInt(searchParams.get("pageSize") ?? "20", 10);
  const typeRaw = searchParams.get("type");
  const type =
    typeRaw && TYPES.has(typeRaw as CreditTransactionType)
      ? (typeRaw as CreditTransactionType)
      : undefined;
  const userEmail = searchParams.get("userEmail") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const generationId = searchParams.get("generationId") ?? undefined;
  const paymentId = searchParams.get("paymentId") ?? undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const amountMin = searchParams.get("amountMin");
  const amountMax = searchParams.get("amountMax");

  const result = await getCreditTransactionList({
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 20,
    type,
    userEmail,
    userId,
    generationId,
    paymentId,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    amountMin: amountMin ? Number.parseInt(amountMin, 10) : undefined,
    amountMax: amountMax ? Number.parseInt(amountMax, 10) : undefined,
  });

  return NextResponse.json({
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    items: result.items.map((i) => ({
      id: i.id,
      type: i.type,
      amount: i.amount,
      reason: i.reason,
      metadata: i.metadata,
      userId: i.userId,
      userEmail: i.user.email,
      generationId: i.generationId,
      paymentId: i.paymentId,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}
