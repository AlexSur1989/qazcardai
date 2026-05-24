import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { rejectKaspiManualPayment } from "@/server/services/payments/kaspiManualConfirmation";

const bodySchema = z
  .object({
    adminComment: z.string().min(1).max(2000).optional(),
    rejectReason: z.string().min(1).max(2000).optional(),
    terminalStatus: z.enum(["FAILED", "CANCELLED"]).optional(),
  })
  .refine((v) => Boolean(v.adminComment?.trim() || v.rejectReason?.trim()), {
    message: "adminComment or rejectReason required",
  });

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/** Алиас для POST /api/admin/payments/[id]/manual-reject */
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

  const rejectReason =
    parsed.data.adminComment?.trim() || parsed.data.rejectReason?.trim() || "";
  const terminalStatus = parsed.data.terminalStatus ?? "FAILED";

  const res = await rejectKaspiManualPayment({
    paymentId: id,
    adminUserId: gate.user.id,
    rejectReason,
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
