import {
  normalizeGptImage2AspectIfOmittedForKie,
  phase1SlugByApiModelId,
} from "@/server/kie/kie-shared-utils";
import {
  generalKieAllowedSettingsKeysForApiModel,
  generalKieDefinitionByApiModelId,
} from "@/server/kie/kie-general-model-definitions";
import { validateHappyHorseSettings } from "@/server/services/happyhorse-settings";
import {
  buildGeminiOmniAudioSyncBody,
  buildGeminiOmniCharacterSyncBody,
  buildGeminiOmniVideoMarketCreateTaskPayload,
} from "@/server/services/provider/kie";
import {
  validateGeminiOmniAudioSettings,
  validateGeminiOmniCharacterSettings,
  validateGeminiOmniVideoSettings,
  isGeminiOmniSyncModelId,
  isGeminiOmniVideoModelId,
  GEMINI_OMNI_AUDIO_API_ID,
  GEMINI_OMNI_CHARACTER_API_ID,
} from "@/server/services/gemini-omni-settings";
import { buildKieMarketPayloadFromMapping, isStrictKiePayloadMapping } from "@/server/services/kiePayloadMapping";
import { validateWan27ModelScenario } from "@/server/services/wan-settings";

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

  const resolution = String(settings.resolution ?? "").trim();
  const allowedRes = new Set(["1K", "2K", "4K"]);
  if (!allowedRes.has(resolution)) {
    return {
      ok: false,
      message: "GPT Image 2: выберите разрешение 1K, 2K или 4K",
    };
  }

  const rawAspect = settings.aspectRatio;
  const aspectMissing =
    rawAspect === undefined ||
    rawAspect === null ||
    String(rawAspect).trim() === "";

  /** Kie OpenAPI: без aspect_ratio допускается только 1K (как для auto). */
  if (aspectMissing) {
    if (resolution !== "1K") {
      return {
        ok: false,
        message: "GPT Image 2: если формат не задан, допустимо только разрешение 1K",
      };
    }
    return { ok: true };
  }

  const aspectRatio = String(rawAspect).trim();
  const allowedAspect = new Set([
    "auto",
    "1:1",
    "9:16",
    "16:9",
    "4:3",
    "3:4",
  ]);
  if (!allowedAspect.has(aspectRatio)) {
    return {
      ok: false,
      message: "GPT Image 2: выберите допустимое значение формата",
    };
  }

  if (aspectRatio === "auto" && resolution !== "1K") {
    return {
      ok: false,
      message: "GPT Image 2: при формате Auto допустимо только разрешение 1K",
    };
  }

  if (aspectRatio === "1:1" && resolution === "4K") {
    return {
      ok: false,
      message: "GPT Image 2: соотношение 1:1 не поддерживает 4K",
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

/** Kie source registry: только ключи из settingsSchema. */
function validateKnownSettingKeysOnly(
  modelId: string,
  settings: Record<string, unknown>,
): ValidationResult {
  const allowed = generalKieAllowedSettingsKeysForApiModel(modelId);
  if (!allowed) return { ok: true };
  for (const k of Object.keys(settings)) {
    if (!allowed.has(k)) {
      return {
        ok: false,
        message: `Поле «${k}» не поддерживается выбранной моделью (проверьте параметры генерации).`,
      };
    }
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

  const phase1Keys = validateKnownSettingKeysOnly(modelId, settings);
  if (!phase1Keys.ok) return phase1Keys;

  const gpt = validateGptImage2Settings(modelId, settings);
  if (!gpt.ok) return gpt;

  const kling = validateKling26Settings(modelId, settings);
  if (!kling.ok) return kling;

  const hh = validateHappyHorseSettings(modelId, settings, prompt.trim());
  if (!hh.ok) return hh;

  const wan = validateWan27ModelScenario(modelId, settings);
  if (!wan.ok) return wan;

  const omniVideo = validateGeminiOmniVideoSettings(modelId, settings);
  if (!omniVideo.ok) return omniVideo;

  const omniAudio = validateGeminiOmniAudioSettings(modelId, settings);
  if (!omniAudio.ok) return omniAudio;

  const omniCharacter = validateGeminiOmniCharacterSettings(modelId, settings);
  if (!omniCharacter.ok) return omniCharacter;

  if (isGeminiOmniSyncModelId(modelId)) {
    try {
      if (modelId === GEMINI_OMNI_AUDIO_API_ID) {
        buildGeminiOmniAudioSyncBody(settings);
      } else if (modelId === GEMINI_OMNI_CHARACTER_API_ID) {
        buildGeminiOmniCharacterSyncBody(settings, inputFiles);
      }
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : "Некорректные настройки Gemini Omni",
      };
    }
  }

  if (!isStrictKiePayloadMapping(model.payloadMapping)) {
    if (phase1SlugByApiModelId(modelId) != null) {
      return {
        ok: false,
        message:
          "Каталог Kie phase1 ожидает strict payloadMapping (adapter «market-create-task» и поле input).",
      };
    }
    if (generalKieDefinitionByApiModelId(modelId)) {
      return {
        ok: false,
        message:
          "Kie registry model ожидает strict payloadMapping (adapter «market-create-task» и поле input).",
      };
    }
    return { ok: true };
  }

  try {
    const settingsForBuild = normalizeGptImage2AspectIfOmittedForKie(
      modelId,
      settings,
    );
    if (isGeminiOmniVideoModelId(modelId)) {
      buildGeminiOmniVideoMarketCreateTaskPayload(
        prompt,
        model,
        settingsForBuild,
        inputFiles,
      );
      return { ok: true };
    }
    buildKieMarketPayloadFromMapping(model.payloadMapping, {
      model: { apiModelId: modelId },
      prompt,
      settings: settingsForBuild,
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
