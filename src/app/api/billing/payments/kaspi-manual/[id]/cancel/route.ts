import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { prisma } from "@/lib/prisma";
import { getKaspiManualBillingPublic } from "@/server/services/kaspiManualSettings";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

function mergeJsonMeta(
  current: Prisma.JsonValue | null,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...extra } as Prisma.InputJsonValue;
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const billing = await getKaspiManualBillingPublic();
  if (!billing.enabled) {
    return NextResponse.json(
      { error: "Ручной перевод Kaspi отключён" },
      { status: 403 },
    );
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const pay = await prisma.payment.findUnique({ where: { id } });
  if (!pay || pay.userId !== current.user.id) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (pay.provider !== KASPI_MANUAL_PAYMENT_PROVIDER) {
    return NextResponse.json({ error: "Неверный тип платежа" }, { status: 400 });
  }
  if (pay.status !== "PENDING" && pay.status !== "PROCESSING") {
    return NextResponse.json(
      { error: "Отмена недоступна для этого статуса" },
      { status: 400 },
    );
  }

  await prisma.payment.update({
    where: { id: pay.id },
    data: {
      status: "CANCELLED",
      metadata: mergeJsonMeta(pay.metadata, {
        cancelledByUserAt: new Date().toISOString(),
      }),
    },
  });

  return NextResponse.json({ ok: true, status: "CANCELLED" });
}
