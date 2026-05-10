import { NextResponse } from "next/server";
import { z } from "zod";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { CreditServiceError } from "@/server/services/credits";
import { adjustUserCreditsApi } from "@/server/services/financeAdmin";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

const bodySchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(300),
  type: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("users.adjust_balance");
  if (!gate.ok) {
    return gate.response;
  }
  const current = gate.user;
  if (rejectOversizedBody(req, getMaxJsonBodyBytes())) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }
  const { id: userId } = await ctx.params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { amount, reason } = parsed.data;
  if (amount === 0) {
    return NextResponse.json({ error: "amount_nonzero" }, { status: 400 });
  }
  try {
    const { newBalance } = await adjustUserCreditsApi({
      adminUserId: current.id,
      userId,
      amount,
      reason,
    });
    return NextResponse.json({ ok: true, newBalance });
  } catch (e) {
    if (e instanceof CreditServiceError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
