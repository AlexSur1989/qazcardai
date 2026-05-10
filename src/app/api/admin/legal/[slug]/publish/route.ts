import { NextResponse } from "next/server";

import { isLegalPageSlug } from "@/lib/legal-page-config";
import { publishLegalPage } from "@/server/services/legalPages";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!isLegalPageSlug(slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  const gate = await requireAdminApiPermission("legal.manage");
  if (!gate.ok) {
    return gate.response;
  }
  try {
    const page = await publishLegalPage({
      slug,
      adminUserId: gate.user.id,
    });
    return NextResponse.json({ page });
  } catch (e) {
    if (e instanceof Error && e.message === "legal_page_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw e;
  }
}
