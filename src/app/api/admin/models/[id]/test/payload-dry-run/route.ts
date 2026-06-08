import { NextResponse } from "next/server";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import {
  buildDryRunKiePayloadForModel,
  loadAiModelForAdminDryRun,
} from "@/server/services/adminModelPayloadDryRun";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

import { adminModelTestBodySchema } from "../_shared";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("models.manage");
  if (!gate.ok) {
    return gate.response;
  }
  if (rejectOversizedBody(req, getMaxJsonBodyBytes())) {
    return NextResponse.json({ error: "body_too_large" }, { status: 413 });
  }

  const { id: modelId } = await ctx.params;
  if (!modelId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  let raw: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      raw = JSON.parse(text) as unknown;
    }
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = adminModelTestBodySchema
    .partial({ prompt: true })
    .safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const model = await loadAiModelForAdminDryRun(modelId);
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const result = await buildDryRunKiePayloadForModel(model, {
    prompt: parsed.data.prompt,
    settings: parsed.data.settings as Record<string, unknown> | undefined,
    inputFiles: parsed.data.inputFiles,
    negativePrompt: parsed.data.negativePrompt,
    aspectRatio: parsed.data.aspectRatio,
    resolution: parsed.data.resolution,
    seed: parsed.data.seed,
    durationSec: parsed.data.durationSec,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    payload: result.payload,
    warnings: result.warnings,
    costCredits: result.costCredits,
  });
}
