import { NextResponse } from "next/server";
import { z } from "zod";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { checkPublicUrlAccess } from "@/server/services/storageMonitor";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

const bodySchema = z.object({
  url: z.string().min(1, "url required"),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("storage.manage");
  if (!gate.ok) {
    return gate.response;
  }
  if (rejectOversizedBody(req, getMaxJsonBodyBytes())) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const r = await checkPublicUrlAccess(parsed.data.url);
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    statusCode: r.statusCode,
    contentType: r.contentType,
    contentLength: r.contentLength,
  });
}
