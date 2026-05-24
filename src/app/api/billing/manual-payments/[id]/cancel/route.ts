import { NextResponse } from "next/server";

import { getKaspiManualSettings } from "@/server/services/kaspiManualSettings";
import { cancelUserManualPayment } from "@/server/services/manualPaymentService";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: RouteContext) {
  const { id } = await context.params;
  const settings = await getKaspiManualSettings();
  if (!settings.kaspiManualEnabled) {
    return NextResponse.json({ error: "Ручное пополнение отключено" }, { status: 403 });
  }

  const current = await getFreshSessionUser();
  if (!current.ok) {
    if (current.reason === "inactive") {
      return NextResponse.json({ error: "Аккаунт недоступен" }, { status: 403 });
    }
    return NextResponse.json({ error: "Требуется вход" }, { status: 401 });
  }

  const result = await cancelUserManualPayment({
    userId: current.user.id,
    paymentId: id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, status: "CANCELLED" });
}
