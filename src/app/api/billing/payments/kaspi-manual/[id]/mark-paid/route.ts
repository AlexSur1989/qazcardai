import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { KASPI_MANUAL_PAYMENT_PROVIDER } from "@/lib/kaspi-manual-config";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
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

const bodySchema = z.object({
  userComment: z.string().max(4000).optional(),
  userReceiptUrl: z.string().url().max(2048).optional().or(z.literal("")),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const billing = await getKaspiManualBillingPublic();
  if (!billing.enabled) {
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
    json = {};
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Проверьте поля" }, { status: 400 });
  }

  const userComment = parsed.data.userComment?.trim().slice(0, 4000) ?? "";
  const userReceiptUrl =
    parsed.data.userReceiptUrl && parsed.data.userReceiptUrl !== ""
      ? parsed.data.userReceiptUrl.trim()
      : "";

  if (billing.requireReceiptUpload && !userReceiptUrl) {
    return NextResponse.json(
      { error: "Загрузите скрин или чек (поле userReceiptUrl)" },
      { status: 400 },
    );
  }

  const pay = await prisma.payment.findUnique({ where: { id } });
  if (!pay || pay.userId !== current.user.id) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (pay.provider !== KASPI_MANUAL_PAYMENT_PROVIDER) {
    return NextResponse.json({ error: "Неверный тип платежа" }, { status: 400 });
  }
  if (pay.status !== "PENDING") {
    if (pay.status === "PROCESSING") {
      return NextResponse.json({
        ok: true,
        status: pay.status,
        alreadyMarked: true,
      });
    }
    return NextResponse.json(
      { error: "Заявка уже закрыта" },
      { status: 400 },
    );
  }

  let expiresAt: string | null = null;
  if (
    pay.metadata &&
    typeof pay.metadata === "object" &&
    !Array.isArray(pay.metadata)
  ) {
    const at = (pay.metadata as Record<string, unknown>).expiresAt;
    if (typeof at === "string") expiresAt = at;
  }
  if (expiresAt && !Number.isNaN(Date.parse(expiresAt))) {
    if (Date.now() > Date.parse(expiresAt)) {
      return NextResponse.json(
        { error: "Срок заявки истёк — создайте новую" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.payment.updateMany({
    where: {
      id: pay.id,
      userId: current.user.id,
      provider: KASPI_MANUAL_PAYMENT_PROVIDER,
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      metadata: mergeJsonMeta(pay.metadata, {
        ...(userComment ? { userComment } : {}),
        ...(userReceiptUrl ? { userReceiptUrl } : {}),
        markedPaidAt: new Date().toISOString(),
      }),
    },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Статус изменился — обновите страницу" }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    status: "PROCESSING",
    alreadyMarked: false,
  });
}
