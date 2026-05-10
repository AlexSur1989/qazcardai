import { NextResponse } from "next/server";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { buildAdminModelKieInput } from "@/server/services/adminModelTest";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

import {
  adminModelTestBodySchema,
  loadAiModelForAdminTest,
} from "../_shared";

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
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = adminModelTestBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const model = await loadAiModelForAdminTest(modelId);
  if (!model) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const input = {
    prompt: parsed.data.prompt,
    settings: parsed.data.settings as Record<string, unknown>,
    inputFiles: parsed.data.inputFiles,
    negativePrompt: parsed.data.negativePrompt,
    aspectRatio: parsed.data.aspectRatio,
    resolution: parsed.data.resolution,
    seed: parsed.data.seed,
    durationSec: parsed.data.durationSec,
  };

  const built = await buildAdminModelKieInput({
    model,
    input,
    checkMotionUrlOwnership: false,
  });
  if (!("kind" in built)) {
    return NextResponse.json(
      { error: built.error },
      { status: built.statusCode },
    );
  }

  return NextResponse.json({
    model: {
      id: model.id,
      name: model.name,
      apiModelId: model.apiModelId,
      endpoint: model.endpoint,
    },
    costCredits: built.costCredits,
    pricing: built.pricing,
    payload: built.payload,
    warnings: built.warnings,
  });
}
