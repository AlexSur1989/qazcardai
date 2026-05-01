import { NextResponse } from "next/server";
import { z } from "zod";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { CreditServiceError } from "@/server/services/credits";
import { adjustUserCreditsApi } from "@/server/services/financeAdmin";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

const bodySchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1).max(300),
  type: z.string().optional(),
});

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  if (current.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "super_admin_only" }, { status: 403 });
  }
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
      adminUserId: current.user.id,
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
