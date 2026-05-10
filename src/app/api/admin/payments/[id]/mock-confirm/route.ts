import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";
import { KASPI_PAYMENT_PROVIDER } from "@/lib/kaspi-config";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { confirmPaymentAndGrantCredits } from "@/server/services/payments/paymentConfirmation";

type RouteContext = { params: Promise<{ id: string }> };

function isMockPaymentMeta(metadata: Prisma.JsonValue | null): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>).mock === true;
}

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  if (payment.provider.trim().toUpperCase() !== KASPI_PAYMENT_PROVIDER) {
    return NextResponse.json({ error: "Не Kaspi" }, { status: 400 });
  }

  if (!isMockPaymentMeta(payment.metadata)) {
    return NextResponse.json({ error: "Только mock-платежи" }, { status: 400 });
  }

  const canManagePayments = hasPermission(current.user.role, "payments.manage");

  if (process.env.NODE_ENV === "production" && !canManagePayments) {
    return NextResponse.json({ error: "Запрещено" }, { status: 403 });
  }

  const allow =
    canManagePayments ||
    (process.env.NODE_ENV !== "production" && payment.userId === current.user.id);

  if (!allow) {
    return NextResponse.json({ error: "Нет прав на подтверждение" }, { status: 403 });
  }

  const amount = Number(payment.amount.toString());
  const res = await confirmPaymentAndGrantCredits({
    paymentId: payment.id,
    provider: KASPI_PAYMENT_PROVIDER,
    providerPaymentId: payment.providerPaymentId,
    rawEvent: { mock: true, source: "POST /api/admin/payments/[id]/mock-confirm" },
    webhookAmountKzt: amount,
    webhookCurrency: payment.currency,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error ?? "Ошибка подтверждения" },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    alreadyConfirmed: res.alreadyConfirmed,
  });
}
