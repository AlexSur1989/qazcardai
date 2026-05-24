import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  createTokenPackageFromApi,
  listTokenPackagesForPricingAdmin,
} from "@/server/services/adminPricingEditor";
import { tokenPackagePriceWarnings } from "@/lib/pricing-admin/token-packages";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("token_packages.manage");
  if (!gate.ok) return gate.response;

  const packages = await listTokenPackagesForPricingAdmin();
  return NextResponse.json({
    packages: packages.map((p) => ({
      ...p,
      pricePerTokenKzt:
        p.totalTokens > 0 ? Math.round((p.priceKzt / p.totalTokens) * 100) / 100 : 0,
      updatedAt: p.updatedAt.toISOString(),
    })),
    softWarnings: tokenPackagePriceWarnings(packages),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("token_packages.manage");
  if (!gate.ok) return gate.response;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const res = await createTokenPackageFromApi({
    input: json,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({ ok: true, id: res.package.id });
}
