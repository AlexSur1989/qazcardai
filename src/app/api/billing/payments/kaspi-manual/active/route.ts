import { NextResponse } from "next/server";

import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { prisma } from "@/lib/prisma";
import { getKaspiManualBillingPublic } from "@/server/services/kaspiManualSettings";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

export async function GET() {
  const billing = await getKaspiManualBillingPublic();
  if (!billing.enabled) {
    return NextResponse.json({ enabled: false, payment: null });
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const row = await prisma.payment.findFirst({
    where: {
      userId: current.user.id,
      provider: KASPI_MANUAL_PAYMENT_PROVIDER,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    orderBy: { createdAt: "desc" },
    include: { tokenPackage: { select: { name: true, slug: true } } },
  });

  if (!row) {
    return NextResponse.json({
      enabled: true,
      settings: billing,
      payment: null,
    });
  }

  const meta = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {};

  const expiresAt =
    typeof meta.expiresAt === "string" ? meta.expiresAt : null;
  const expired =
    expiresAt && !Number.isNaN(Date.parse(expiresAt))
      ? Date.now() > Date.parse(expiresAt)
      : false;

  return NextResponse.json({
    enabled: true,
    settings: billing,
    payment: {
      id: row.id,
      status: row.status,
      amount: Number(row.amount.toString()),
      currency: row.currency,
      credits: row.credits,
      createdAt: row.createdAt.toISOString(),
      providerPaymentId: row.providerPaymentId,
      instructionCode:
        (typeof meta.instructionCode === "string" && meta.instructionCode) ||
        row.providerPaymentId,
      recipientName:
        typeof meta.kaspiRecipientName === "string"
          ? meta.kaspiRecipientName
          : "",
      kaspiRecipientPhoneMasked:
        typeof meta.kaspiRecipientPhoneMasked === "string"
          ? meta.kaspiRecipientPhoneMasked
          : "",
      instructionText: billing.instructionText,
      expiresAt,
      expired,
      userComment:
        typeof meta.userComment === "string" ? meta.userComment : "",
      userReceiptUrl:
        typeof meta.userReceiptUrl === "string" ? meta.userReceiptUrl : "",
      tokenPackageName: row.tokenPackage?.name ?? "Пакет",
    },
  });
}
