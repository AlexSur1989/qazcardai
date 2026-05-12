import { NextResponse } from "next/server";

import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { confirmKaspiManualPayment } from "@/server/services/payments/kaspiManualConfirmation";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: RouteContext) {
  const gate = await requireAdminApiPermission("payments.manage");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const res = await confirmKaspiManualPayment({
    paymentId: id,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    const map: Record<string, number> = {
      NOT_FOUND: 404,
      PROVIDER_MISMATCH: 400,
      BAD_STATUS: 400,
      MISSING_TOKEN_PACKAGE: 400,
      CONCURRENT_UPDATE: 409,
    };
    const status = map[res.error] ?? 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    alreadyConfirmed: res.alreadyConfirmed,
  });
}
