import { NextResponse } from "next/server";

import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { runMarketplaceCardPreflight } from "@/server/services/marketplaceCardPreflight";

export const dynamic = "force-dynamic";

export async function POST() {
  const base = await requireAdminApiPermission("models.product_card.manage");
  if (!base.ok) {
    return base.response;
  }

  const result = await runMarketplaceCardPreflight();
  return NextResponse.json(result);
}
