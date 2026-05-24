import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import {
  createManualPaymentRequest,
  findUserOpenManualPayment,
  getUserTelegramUsername,
  listUserManualPayments,
  serializeManualPaymentForClient,
} from "@/server/services/manualPaymentService";
import { getKaspiManualSettings } from "@/server/services/kaspiManualSettings";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  packageId: z.string().cuid(),
  contactChannel: z.enum(["whatsapp", "kaspi"]).optional().default("whatsapp"),
});

export async function GET() {
  const settings = await getKaspiManualSettings();
  if (!settings.kaspiManualEnabled) {
    return NextResponse.json({ enabled: false, requests: [] });
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const [rows, active, userTelegram] = await Promise.all([
    listUserManualPayments(current.user.id, 30),
    findUserOpenManualPayment(current.user.id),
    getUserTelegramUsername(current.user.id),
  ]);

  const requests = rows.map((p) =>
    serializeManualPaymentForClient({
      payment: p,
      settings,
      userEmail: current.user.email,
      userTelegram,
    }),
  );

  const activeRequest = active
    ? serializeManualPaymentForClient({
        payment: active,
        settings,
        userEmail: current.user.email,
        userTelegram,
      })
    : null;

  return NextResponse.json({
    enabled: true,
    activeRequest,
    requests,
  });
}

export async function POST(req: Request) {
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

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors[0] ?? "Проверьте поля" },
      { status: 400 },
    );
  }

  const userTelegram = await getUserTelegramUsername(current.user.id);

  const result = await createManualPaymentRequest({
    userId: current.user.id,
    userEmail: current.user.email,
    userTelegram,
    packageId: parsed.data.packageId,
    contactChannel: parsed.data.contactChannel,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.existingPaymentId
          ? { existingPaymentId: result.existingPaymentId }
          : {}),
      },
      { status: result.status },
    );
  }

  const row = result.row;
  return NextResponse.json({
    requestId: row.requestId,
    paymentCode: row.paymentCode,
    amountKzt: row.amountKzt,
    creditsAmount: row.creditsAmount,
    packageLabel: row.packageLabel,
    whatsappUrl: row.whatsappUrl,
    status: row.status,
    statusLabel: row.statusLabel,
    contactChannel: row.contactChannel,
    kaspiRecipientPhoneMasked: row.kaspiRecipientPhoneMasked,
    recipientName: row.recipientName,
    instructionText: row.instructionText,
    expiresAt: row.expiresAt,
  });
}
