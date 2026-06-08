import { NextResponse } from "next/server";

import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";
import { runClassifierPreflight } from "@/server/services/classifierPreflight";

export async function POST() {
  const gate = await requireAdminApiPermission("models.product_card.manage");
  if (!gate.ok) {
    return gate.response;
  }

  const result = await runClassifierPreflight();
  return NextResponse.json(result);
}
