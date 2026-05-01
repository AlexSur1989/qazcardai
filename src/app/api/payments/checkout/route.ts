import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getFreshSessionUser } from "@/server/services/fresh-session-user";
import { getPaymentCheckoutProvider } from "@/server/services/payment-providers/registry";

const bodySchema = z.object({
  packageId: z.string().cuid("Некорректный идентификатор пакета"),
  provider: z.enum(["stripe"]).default("stripe"),
});

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
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Проверьте packageId" },
      { status: 400 },
    );
  }
  const { packageId, provider } = parsed.data;
  const p = getPaymentCheckoutProvider(provider);
  if (!p) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 400 });
  }
  const res = await p.createCheckout({
    userId: current.user.id,
    userEmail: current.user.email,
    packageId,
  });
  if (!res.ok) {
    if (res.error === "not_configured") {
      return NextResponse.json(
        { error: "Платежи не настроены на сервере" },
        { status: 503 },
      );
    }
    if (res.error === "package_unavailable") {
      return NextResponse.json(
        { error: "Пакет недоступен или снят с продаж" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Не удалось создать оплату" }, { status: 500 });
  }
  return NextResponse.json({ url: res.url });
}
