import { buildKieMarketPayloadFromMapping, isStrictKiePayloadMapping } from "@/server/services/kiePayloadMapping";

type ValidationResult = { ok: true } | { ok: false; message: string };

type ModelForKiePayloadValidation = {
  apiModelId: string;
  payloadMapping: unknown;
};

function validateGptImage2Settings(
  modelId: string,
  settings: Record<string, unknown>,
): ValidationResult {
  if (
    modelId !== "gpt-image-2-text-to-image" &&
    modelId !== "gpt-image-2-image-to-image"
  ) {
    return { ok: true };
  }

  const aspectRatio = String(settings.aspectRatio ?? "").trim();
  const resolution = String(settings.resolution ?? "1K").trim();

  if (aspectRatio === "auto" && resolution !== "1K") {
    return {
      ok: false,
      message: "GPT Image 2: для формата auto доступно только разрешение 1K",
    };
  }
  if (aspectRatio === "1:1" && resolution === "4K") {
    return {
      ok: false,
      message: "GPT Image 2: для формата 1:1 разрешение 4K недоступно",
    };
  }
  return { ok: true };
}

function validateKling26Settings(
  modelId: string,
  settings: Record<string, unknown>,
): ValidationResult {
  if (
    modelId !== "kling-2.6/text-to-video" &&
    modelId !== "kling-2.6/image-to-video"
  ) {
    return { ok: true };
  }

  const duration = String(settings.duration ?? "").trim();
  if (duration !== "5" && duration !== "10") {
    return {
      ok: false,
      message: "Kling 2.6: длительность должна быть 5 или 10 секунд",
    };
  }
  if (typeof settings.sound !== "boolean") {
    return {
      ok: false,
      message: "Kling 2.6: поле «Звук» должно быть true или false",
    };
  }
  return { ok: true };
}

/**
 * Strict Kie Market models are validated from their own payloadMapping before
 * reserveCredits, so missing upload-list values fail before token reservation.
 */
export function validateStrictKieMarketPayload(
  model: ModelForKiePayloadValidation,
  prompt: string,
  settings: Record<string, unknown>,
  inputFiles: string[] = [],
): ValidationResult {
  const modelId = model.apiModelId.trim();

  const gpt = validateGptImage2Settings(modelId, settings);
  if (!gpt.ok) return gpt;

  const kling = validateKling26Settings(modelId, settings);
  if (!kling.ok) return kling;

  if (!isStrictKiePayloadMapping(model.payloadMapping)) {
    return { ok: true };
  }

  try {
    buildKieMarketPayloadFromMapping(model.payloadMapping, {
      model: { apiModelId: modelId },
      prompt,
      settings,
      inputFiles,
      callBackUrl: "https://example.com/api/webhooks/kie",
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Некорректные настройки Kie",
    };
  }
}
