import type { AiModel } from "@/generated/prisma/client";
import { isRecord } from "@/lib/model-pricing-shared";
import { PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE } from "@/config/product-classifier-kie-prompt";
import { buildProductClassifierChatPayload } from "@/server/services/productClassifierKieChat";

function isPlaceholderApiModelId(apiModelId: string): boolean {
  const t = apiModelId.trim().toUpperCase();
  return t === "PLACEHOLDER" || t === "CHANGE_ME" || t.startsWith("PASTE_");
}

export function collectClassifierModelDryRunWarnings(model: AiModel): string[] {
  const warnings: string[] = [];
  if (model.productCardModelType !== "PRODUCT_CLASSIFIER") {
    warnings.push("productCardModelType is not PRODUCT_CLASSIFIER");
  }
  if (model.scope !== "PRODUCT_CARD") {
    warnings.push("scope is not PRODUCT_CARD");
  }
  if (!model.isActive) {
    warnings.push("model is inactive");
  }
  if (!model.apiModelId?.trim()) {
    warnings.push("missing apiModelId");
  } else if (isPlaceholderApiModelId(model.apiModelId)) {
    warnings.push("apiModelId is PLACEHOLDER");
  }
  if (!model.endpoint?.trim()) {
    warnings.push("endpoint missing");
  }
  if (!model.supportsImageInput) {
    warnings.push("supportsImageInput=false");
  }
  if (!isRecord(model.payloadMapping) || Object.keys(model.payloadMapping).length === 0) {
    warnings.push("payloadMapping missing");
  }
  if (!isRecord(model.pricingSchema) || Object.keys(model.pricingSchema).length === 0) {
    warnings.push("pricingSchema missing");
  }
  if (model.costCredits <= 0) {
    warnings.push("costCredits must be greater than 0");
  }
  return warnings;
}

export function isCriticalClassifierDryRunWarning(warning: string): boolean {
  return /missing apiModelId|PLACEHOLDER|endpoint missing|supportsImageInput=false|payloadMapping missing|pricingSchema missing|costCredits must be greater than 0|productCardModelType|scope is not/i.test(
    warning,
  );
}

export function validateClassifierDryRunPayloadShape(payload: unknown): string[] {
  const issues: string[] = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["payload root must be object"];
  }
  const o = payload as Record<string, unknown>;
  if (typeof o.model !== "string" || !o.model.trim()) {
    issues.push("payload.model must be non-empty string");
  }
  if (o.stream !== false) {
    issues.push("payload.stream must be false");
  }
  if (!Array.isArray(o.messages) || o.messages.length < 2) {
    issues.push("payload.messages must contain system + user");
    return issues;
  }
  const userMsg = o.messages[1];
  if (!userMsg || typeof userMsg !== "object" || Array.isArray(userMsg)) {
    issues.push("messages[1] must be user message object");
    return issues;
  }
  const content = (userMsg as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    issues.push("messages[1].content must be array");
    return issues;
  }
  const hasText = content.some(
    (p) =>
      p &&
      typeof p === "object" &&
      !Array.isArray(p) &&
      (p as Record<string, unknown>).type === "text",
  );
  const imagePart = content.find(
    (p) =>
      p &&
      typeof p === "object" &&
      !Array.isArray(p) &&
      (p as Record<string, unknown>).type === "image_url",
  );
  if (!hasText) issues.push("messages[1].content must include text part");
  if (!imagePart) {
    issues.push("messages[1].content must include image_url part");
  } else {
    const iu = (imagePart as Record<string, unknown>).image_url;
    if (!iu || typeof iu !== "object" || Array.isArray(iu)) {
      issues.push("image_url object missing");
    } else {
      const url = (iu as Record<string, unknown>).url;
      if (typeof url !== "string" || !url.trim()) {
        issues.push("image_url.url must be non-empty string");
      }
    }
  }
  return issues;
}

export function buildClassifierChatDryRunPayload(
  model: AiModel,
  imageUrl = PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE,
): Record<string, unknown> {
  return buildProductClassifierChatPayload({
    apiModelId: model.apiModelId,
    imageUrl,
    stream: false,
  });
}

export async function buildDryRunClassifierPayloadForModel(
  model: AiModel,
  imageUrl?: string,
): Promise<
  | { ok: true; payload: unknown; warnings: string[]; costCredits: number }
  | { ok: false; error: string }
> {
  const warnings = collectClassifierModelDryRunWarnings(model);
  try {
    const payload = buildClassifierChatDryRunPayload(
      model,
      imageUrl?.trim() || PRODUCT_CLASSIFIER_DRY_RUN_SAMPLE_IMAGE,
    );
    const shapeIssues = validateClassifierDryRunPayloadShape(payload);
    for (const issue of shapeIssues) {
      warnings.push(issue);
    }
    return {
      ok: true,
      payload,
      warnings,
      costCredits: model.costCredits,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to build classifier dry-run payload",
    };
  }
}
