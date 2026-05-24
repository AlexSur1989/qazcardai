import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { updateTokenPackageFromApi } from "@/server/services/adminPricingEditor";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const gate = await requireAdminApiPermission("token_packages.manage");
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

  const res = await updateTokenPackageFromApi({
    id,
    input: json,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ ok: true });
}
