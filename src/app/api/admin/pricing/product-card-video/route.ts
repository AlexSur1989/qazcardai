import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { buildProductCardVideoFormulaText } from "@/lib/pricing-admin/product-card-video";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  loadProductCardVideoPricingForAdmin,
  resetProductCardVideoPricingDraft,
  saveProductCardVideoPricing,
} from "@/server/services/adminProductCardVideoPricingEditor";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const { pricing, formula, cellPreviews } = await loadProductCardVideoPricingForAdmin();
  return NextResponse.json({
    pricing,
    formula,
    cellPreviews,
    warnings: pricing?.warnings ?? ["Модель видео товара (PRODUCT_VIDEO) не найдена."],
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

  const res = await saveProductCardVideoPricing({
    input: json,
    adminUserId: gate.user.id,
    adminRole: gate.user.role,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    pricing: res.pricing,
    formula: res.formula,
    estimateSamples: res.estimateSamples,
    warnings: res.pricing.warnings,
  });
}

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("models.pricing.manage");
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "reset-current") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const modelId =
    json && typeof json === "object" && "modelId" in json && typeof json.modelId === "string"
      ? json.modelId
      : "";
  if (!modelId) {
    return NextResponse.json({ error: "modelId обязателен" }, { status: 400 });
  }

  const res = await resetProductCardVideoPricingDraft({ modelId });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    pricing: res.pricing,
    formula: res.formula ?? buildProductCardVideoFormulaText({
      hasMultipliers: res.pricing.hasMultipliers,
      minVideoTokens: res.pricing.minVideoTokens,
    }),
    warnings: res.pricing.warnings,
  });
}
