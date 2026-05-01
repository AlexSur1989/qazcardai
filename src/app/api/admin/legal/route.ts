import { NextResponse } from "next/server";

import { getAdminLegalPages } from "@/server/services/legalPages";
import { getFreshAdminSessionUser } from "@/server/services/fresh-session-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = await getFreshAdminSessionUser();
  if (!current.ok) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: current.reason === "unauthenticated" ? 401 : 403 },
    );
  }
  const items = await getAdminLegalPages();
  return NextResponse.json({ items });
}
