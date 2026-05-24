import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  loadCardBuilderPricingForAdmin,
  resetCardBuilderPricingToDefault,
  saveCardBuilderPricing,
} from "@/server/services/adminPricingEditor";
import {
  buildCardBuilderPricingPreview,
  cardBuilderPricingSoftWarnings,
  cardBuilderPricingToProductCardShape,
} from "@/lib/pricing-admin/card-builder";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const { pricing, meta } = await loadCardBuilderPricingForAdmin();
  const shape = cardBuilderPricingToProductCardShape(pricing);
  return NextResponse.json({
    pricing,
    meta,
    preview: buildCardBuilderPricingPreview(shape),
    softWarnings: cardBuilderPricingSoftWarnings(pricing),
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const res = await saveCardBuilderPricing({
    input: json,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const shape = cardBuilderPricingToProductCardShape(res.pricing);
  return NextResponse.json({
    ok: true,
    pricing: res.pricing,
    preview: buildCardBuilderPricingPreview(shape),
    softWarnings: cardBuilderPricingSoftWarnings(res.pricing),
  });
}

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "reset-default") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  const res = await resetCardBuilderPricingToDefault({ adminUserId: gate.user.id });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  const shape = cardBuilderPricingToProductCardShape(res.pricing);
  return NextResponse.json({
    ok: true,
    pricing: res.pricing,
    preview: buildCardBuilderPricingPreview(shape),
    softWarnings: cardBuilderPricingSoftWarnings(res.pricing),
  });
}
