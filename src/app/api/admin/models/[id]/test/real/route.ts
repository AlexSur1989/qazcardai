import { NextResponse } from "next/server";

import { getMaxJsonBodyBytes, rejectOversizedBody } from "@/lib/request-body-limits";
import { runAdminModelRealKieTest } from "@/server/services/adminModelTest";
import { requireAdminApiPermission } from "@/server/guards/admin-api-permission";

import {
  adminModelTestBodySchema,
  loadAiModelForAdminTest,
} from "../_shared";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAdminApiPermission("providers.manage");
  if (!gate.ok) {
    return gate.response;
  }
  const current = gate.user;
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

  const result = await runAdminModelRealKieTest({
    model,
    input,
    adminUserId: current.id,
  });
  if (result.ok) {
    return NextResponse.json({
      ok: true,
      providerTaskId: result.providerTaskId,
      status: result.status,
      payload: result.payload,
      providerResponse: result.providerResponse,
    });
  }
  if (result.httpStatus === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        statusCode: result.statusCode,
      },
      { status: result.statusCode || 400 },
    );
  }
  return NextResponse.json({
    ok: false,
    error: result.error,
    statusCode: result.statusCode,
    payload: result.payload,
    providerResponse: result.providerResponse,
  });
}
