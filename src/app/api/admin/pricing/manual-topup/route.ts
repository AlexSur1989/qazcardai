import { NextResponse } from "next/server";

import {
  getMaxJsonBodyBytes,
  rejectOversizedBody,
} from "@/lib/request-body-limits";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import {
  loadKaspiManualForAdmin,
  saveKaspiManualPricing,
} from "@/server/services/adminPricingEditor";
import {
  buildWhatsAppTestPreviewUrl,
  kaspiManualSoftWarnings,
} from "@/lib/pricing-admin/kaspi-manual";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiPermission("settings.manage");
  if (!gate.ok) return gate.response;

  const { settings, meta } = await loadKaspiManualForAdmin();
  return NextResponse.json({
    settings,
    meta,
    softWarnings: kaspiManualSoftWarnings(settings),
    whatsappTestUrl: settings.whatsappEnabled
      ? buildWhatsAppTestPreviewUrl({
          whatsappPhone: settings.whatsappPhone,
          template: settings.whatsappMessageTemplate,
        })
      : null,
  });
}

export async function PATCH(req: Request) {
  const gate = await requireAdminApiPermission("settings.manage");
  if (!gate.ok) return gate.response;

  const tooLarge = rejectOversizedBody(req, getMaxJsonBodyBytes());
  if (tooLarge) return tooLarge;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const res = await saveKaspiManualPricing({
    input: json,
    adminUserId: gate.user.id,
  });

  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status });
  }

  return NextResponse.json({
    ok: true,
    settings: res.settings,
    softWarnings: kaspiManualSoftWarnings(res.settings),
    whatsappTestUrl: res.settings.whatsappEnabled
      ? buildWhatsAppTestPreviewUrl({
          whatsappPhone: res.settings.whatsappPhone,
          template: res.settings.whatsappMessageTemplate,
        })
      : null,
  });
}
