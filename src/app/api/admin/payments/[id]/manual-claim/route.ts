import { NextResponse } from "next/server";

import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { claimKaspiManualForReview } from "@/server/services/payments/kaspiManualConfirmation";

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(_req: Request, context: RouteContext) {
  const gate = await requireAdminApiPermission("payments.manage");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const res = await claimKaspiManualForReview({
    paymentId: id,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    const status =
      res.error === "NOT_FOUND"
        ? 404
        : res.error === "PROVIDER_MISMATCH"
          ? 400
          : res.error === "BAD_STATUS"
            ? 400
            : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  return NextResponse.json({ ok: true, claimed: res.claimed });
}
