import { NextResponse } from "next/server";

import { paymentStatusForBillingApi } from "@/lib/billing-payment-api";
import { canAccessAdminPanel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { tokenPackage: { select: { name: true } } },
  });

  if (!payment) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const isOwner = payment.userId === current.user.id;
  const isAdmin = canAccessAdminPanel(current.user.role);
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }

  return NextResponse.json({
    id: payment.id,
    status: paymentStatusForBillingApi(payment.status),
    provider: payment.provider,
    amount: Number(payment.amount.toString()),
    currency: payment.currency,
    credits: payment.credits,
    tokenPackageName: payment.tokenPackage?.name ?? null,
    createdAt: payment.createdAt.toISOString(),
    paidAt: payment.paidAt?.toISOString() ?? null,
  });
}
