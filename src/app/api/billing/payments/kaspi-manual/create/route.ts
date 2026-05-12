import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import { prisma } from "@/lib/prisma";
import {
  getKaspiManualSettings,
  maskKaspiRecipientPhone,
} from "@/server/services/kaspiManualSettings";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  getTokenPackageByIdForCheckout,
  getTokenPackageBySlugForCheckout,
} from "@/server/services/token-packages-catalog";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
  );
}

function buildInstructionCode(prefix: string): string {
  const p =
    prefix.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "QAZ";
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const rand = randomBytes(3).toString("hex").toUpperCase().slice(0, 4);
  return `${p}-${ymd}-${rand}`;
}

const bodySchema = z
  .object({
    tokenPackageId: z.string().cuid().optional(),
    tokenPackageSlug: z.string().min(1).optional(),
  })
  .refine(
    (v) => Boolean(v.tokenPackageId?.trim()) || Boolean(v.tokenPackageSlug?.trim()),
    "Укажите tokenPackageId или tokenPackageSlug",
  );

export async function POST(req: Request) {
  const settings = await getKaspiManualSettings();
  if (!settings.kaspiManualEnabled) {
    return NextResponse.json(
      { error: "Ручной перевод Kaspi отключён" },
      { status: 503 },
    );
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
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] ?? "Проверьте поля" },
      { status: 400 },
    );
  }

  let pkg = null;
  if (parsed.data.tokenPackageId) {
    pkg = await getTokenPackageByIdForCheckout(parsed.data.tokenPackageId, {
      requireActive: true,
    });
  } else if (parsed.data.tokenPackageSlug) {
    pkg = await getTokenPackageBySlugForCheckout(parsed.data.tokenPackageSlug, {
      requireActive: true,
    });
  }

  if (!pkg) {
    return NextResponse.json({ error: "Пакет не найден или недоступен" }, { status: 400 });
  }

  const openManual = await prisma.payment.findFirst({
    where: {
      userId: current.user.id,
      provider: KASPI_MANUAL_PAYMENT_PROVIDER,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (openManual) {
    return NextResponse.json(
      {
        error: "У вас уже есть активная заявка Kaspi перевод. Отмените её или дождитесь проверки.",
        existingPaymentId: openManual.id,
      },
      { status: 409 },
    );
  }

  const totalTokens = pkg.baseTokens + pkg.bonusTokens;
  if (totalTokens <= 0) {
    return NextResponse.json({ error: "Пакет не содержит токенов" }, { status: 400 });
  }

  const masked = maskKaspiRecipientPhone(settings.recipientPhone);
  const expiresAt = new Date(
    Date.now() + settings.expiresMinutes * 60 * 1000,
  ).toISOString();

  for (let attempt = 0; attempt < 20; attempt++) {
    const instructionCode = buildInstructionCode(settings.paymentCodePrefix);
    try {
      const payment = await prisma.payment.create({
        data: {
          userId: current.user.id,
          tokenPackageId: pkg.id,
          provider: KASPI_MANUAL_PAYMENT_PROVIDER,
          providerPaymentId: instructionCode,
          amount: new Prisma.Decimal(pkg.priceKzt),
          currency: "KZT",
          credits: totalTokens,
          status: "PENDING",
          metadata: {
            manualKaspi: true,
            instructionCode,
            kaspiRecipientName: settings.recipientName,
            kaspiRecipientPhoneMasked: masked,
            expiresAt,
            tokenPackageId: pkg.id,
            tokenPackageSlug: pkg.slug,
            priceKzt: pkg.priceKzt,
            baseTokens: pkg.baseTokens,
            bonusTokens: pkg.bonusTokens,
            totalTokens,
          } satisfies Prisma.InputJsonObject,
        },
      });

      return NextResponse.json({
        paymentId: payment.id,
        status: payment.status,
        provider: KASPI_MANUAL_PAYMENT_PROVIDER,
        amount: pkg.priceKzt,
        currency: "KZT",
        credits: totalTokens,
        instructionCode,
        recipientName: settings.recipientName,
        kaspiRecipientPhoneMasked: masked,
        instructionText: settings.instructionText,
        expiresAt,
        tokenPackageName: pkg.name,
      });
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      console.error("[kaspi-manual/create]", e);
      return NextResponse.json(
        { error: "Не удалось создать платёж" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Не удалось сгенерировать уникальный код — повторите" },
    { status: 503 },
  );
}
