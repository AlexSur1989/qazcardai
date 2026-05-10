import { NextResponse } from "next/server";
import { z } from "zod";

import { moderateGenerationInput } from "@/server/services/moderation";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  prompt: z.string().max(1_000_000),
});

export async function POST(req: Request) {
  const gate = await requireAdminApiPermission("moderation.access");
  if (!gate.ok) {
    return gate.response;
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "bad_request" },
      { status: 400 },
    );
  }
  const r = await moderateGenerationInput({
    prompt: parsed.data.prompt,
    negativePrompt: null,
    flow: "admin_test",
    userId: gate.user.id,
  });
  if (r.allowed) {
    return NextResponse.json({
      allowed: true,
    });
  }
  return NextResponse.json({
    allowed: false,
    reason: r.reason,
    rule: r.rule,
    matchedText: r.matchedText,
  });
}
