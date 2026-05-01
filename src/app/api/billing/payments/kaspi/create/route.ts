import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import {
  getAppBaseUrl,
  KASPI_PAYMENT_PROVIDER,
  isKaspiBillingEnabled,
} from "@/lib/kaspi-config";
import { prisma } from "@/lib/prisma";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { createKaspiPayment } from "@/server/services/payments/providers/kaspi";
import { getTokenPackageByIdForCheckout } from "@/server/services/token-packages-catalog";

const bodySchema = z.object({
  tokenPackageId: z.string().cuid("Некорректный идентификатор пакета"),
});

function mergeMeta(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Prisma.InputJsonValue {
  return { ...base, ...extra } as Prisma.InputJsonValue;
}

export async function POST(req: Request) {
  if (!isKaspiBillingEnabled()) {
    return NextResponse.json({ error: "Оплата Kaspi отключена" }, { status: 503 });
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте tokenPackageId" }, { status: 400 });
  }

  const pkg = await getTokenPackageByIdForCheckout(parsed.data.tokenPackageId, {
    requireActive: true,
  });
  if (!pkg) {
    return NextResponse.json({ error: "Пакет не найден или недоступен" }, { status: 400 });
  }

  const totalTokens = pkg.baseTokens + pkg.bonusTokens;
  if (totalTokens <= 0) {
    return NextResponse.json({ error: "Пакет не содержит токенов" }, { status: 400 });
  }

  const returnUrl =
    process.env.KASPI_RETURN_URL?.trim() || `${getAppBaseUrl()}/dashboard/billing`;
  const webhookUrl =
    process.env.KASPI_WEBHOOK_URL?.trim() || `${getAppBaseUrl()}/api/webhooks/kaspi`;

  try {
    const { payment, kaspi } = await prisma.$transaction(async (tx) => {
      const paymentRow = await tx.payment.create({
        data: {
          userId: current.user.id,
          tokenPackageId: pkg.id,
          provider: KASPI_PAYMENT_PROVIDER,
          providerPaymentId: null,
          amount: new Prisma.Decimal(pkg.priceKzt),
          currency: "KZT",
          credits: totalTokens,
          status: "PENDING",
          metadata: {
            tokenPackageId: pkg.id,
            tokenPackageSlug: pkg.slug,
            priceKzt: pkg.priceKzt,
            baseTokens: pkg.baseTokens,
            bonusTokens: pkg.bonusTokens,
            totalTokens,
          } satisfies Prisma.InputJsonObject,
        },
      });

      const kaspiRes = await createKaspiPayment({
        paymentId: paymentRow.id,
        amountKzt: pkg.priceKzt,
        description: pkg.name,
        userId: current.user.id,
        userEmail: current.user.email,
        returnUrl,
        webhookUrl,
      });

      const meta = mergeMeta((paymentRow.metadata as Record<string, unknown>) ?? {}, {
        providerPaymentId: kaspiRes.providerPaymentId,
        paymentUrl: kaspiRes.paymentUrl,
        qrUrl: kaspiRes.qrUrl,
        mock: kaspiRes.raw.mock === true,
        kaspiReturnUrl: returnUrl,
        kaspiWebhookUrl: webhookUrl,
      });

      await tx.payment.update({
        where: { id: paymentRow.id },
        data: {
          providerPaymentId: kaspiRes.providerPaymentId,
          metadata: meta,
        },
      });

      return { payment: paymentRow, kaspi: kaspiRes };
    });

    return NextResponse.json({
      paymentId: payment.id,
      status: "PENDING",
      provider: KASPI_PAYMENT_PROVIDER,
      paymentUrl: kaspi.paymentUrl,
      qrUrl: kaspi.qrUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "KASPI_LIVE_NOT_IMPLEMENTED") {
      return NextResponse.json(
        { error: "Режим live Kaspi ещё не подключён" },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: "Не удалось создать платёж" }, { status: 500 });
  }
}
