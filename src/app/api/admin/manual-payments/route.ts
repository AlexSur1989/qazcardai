import { NextResponse } from "next/server";

import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { manualPaymentContactChannelLabel } from "@/lib/manual-payment-labels";
import { prisma } from "@/lib/prisma";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  readPaymentMetadata,
  isManualPaymentExpired,
} from "@/server/services/manualPaymentService";
import { manualPaymentUserStatusLabel } from "@/lib/manual-payment-labels";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireAdminApiPermission("payments.view");
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.trim() || undefined;
  const take = Math.min(
    100,
    Math.max(1, Number.parseInt(url.searchParams.get("take") ?? "50", 10) || 50),
  );

  const rows = await prisma.payment.findMany({
    where: {
      provider: KASPI_MANUAL_PAYMENT_PROVIDER,
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          identities: {
            where: { provider: "telegram" },
            select: { username: true },
            take: 1,
          },
        },
      },
      tokenPackage: { select: { name: true } },
    },
  });

  return NextResponse.json({
    requests: rows.map((p) => {
      const meta = readPaymentMetadata(p.metadata);
      const expired = isManualPaymentExpired(meta);
      const contactChannel =
        typeof meta.contactChannel === "string" ? meta.contactChannel : "kaspi";
      const telegramUsername = p.user.identities[0]?.username ?? null;
      return {
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        userId: p.userId,
        userEmail: p.user.email,
        userName: p.user.name,
        telegramUsername,
        amountKzt: Number(p.amount.toString()),
        creditsAmount: p.credits,
        paymentCode: p.providerPaymentId,
        packageLabel: p.tokenPackage?.name ?? "—",
        contactChannel,
        contactChannelLabel: manualPaymentContactChannelLabel(contactChannel),
        status: p.status,
        statusLabel: manualPaymentUserStatusLabel(p.status, expired),
      };
    }),
  });
}
