import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { rejectKaspiManualPayment } from "@/server/services/payments/kaspiManualConfirmation";

const bodySchema = z.object({
  rejectReason: z.string().min(1).max(2000),
  terminalStatus: z.enum(["FAILED", "CANCELLED"]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, context: RouteContext) {
  const gate = await requireAdminApiPermission("payments.manage");
  if (!gate.ok) return gate.response;

  const { id } = await context.params;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const terminalStatus = parsed.data.terminalStatus ?? "FAILED";

  const res = await rejectKaspiManualPayment({
    paymentId: id,
    adminUserId: gate.user.id,
    rejectReason: parsed.data.rejectReason,
    terminalStatus,
  });

  if (!res.ok) {
    const status =
      res.error === "NOT_FOUND"
        ? 404
        : res.error === "PROVIDER_MISMATCH"
          ? 400
          : res.error === "ALREADY_COMPLETED"
            ? 400
            : res.error === "BAD_STATUS"
              ? 400
              : 400;
    return NextResponse.json({ error: res.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
