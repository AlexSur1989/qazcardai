import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { getPaymentCheckoutProvider } from "@/server/services/payment-providers/registry";

const bodySchema = z.object({
  packageId: z.string().min(1).max(64),
  provider: z.enum(["stripe"]).default("stripe"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
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
    userId: session.user.id,
    userEmail: session.user.email,
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
