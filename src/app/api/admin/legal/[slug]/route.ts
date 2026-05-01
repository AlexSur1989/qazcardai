import { NextResponse } from "next/server";
import { z } from "zod";

import { isSuperAdmin } from "@/lib/auth";
import { isLegalPageSlug, LEGAL_PAGE_STATUS } from "@/lib/legal-page-config";
import { getAdminLegalPage, updateLegalPage } from "@/server/services/legalPages";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  status: z.enum([LEGAL_PAGE_STATUS.DRAFT, LEGAL_PAGE_STATUS.PUBLISHED]),
});

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, context: RouteContext) {
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
  const page = await getAdminLegalPage(slug);
  if (!page) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ page });
}

export async function PATCH(req: Request, context: RouteContext) {
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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const page = await updateLegalPage({
      slug,
      title: parsed.data.title,
      content: parsed.data.content,
      status: parsed.data.status,
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
