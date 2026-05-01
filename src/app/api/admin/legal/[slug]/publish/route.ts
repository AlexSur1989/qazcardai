import { NextResponse } from "next/server";

import { isSuperAdmin } from "@/lib/auth";
import { isLegalPageSlug } from "@/lib/legal-page-config";
import { publishLegalPage } from "@/server/services/legalPages";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (!isLegalPageSlug(slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  if (!isSuperAdmin(current.user.role)) {
    return NextResponse.json({ error: "super_admin_only" }, { status: 403 });
  }
  try {
    const page = await publishLegalPage({
      slug,
      adminUserId: current.user.id,
    });
    return NextResponse.json({ page });
  } catch (e) {
    if (e instanceof Error && e.message === "legal_page_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    throw e;
  }
}
